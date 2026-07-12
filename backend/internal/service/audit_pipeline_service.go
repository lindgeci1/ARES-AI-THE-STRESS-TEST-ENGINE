package service

import (
	"archive/zip"
	"bytes"
	"encoding/json"
	"encoding/xml"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"ares-ai-backend/internal/models"
	"ares-ai-backend/internal/repository"

	"github.com/ledongthuc/pdf"
	"gorm.io/datatypes"
)

type AuditPipelineService struct {
	documentRepo      *repository.DocumentRepository
	ollamaService     *OllamaService
	ttsService        *TTSService
	cloudinaryService *CloudinaryService
	httpClient        *http.Client
}

func NewAuditPipelineService(
	documentRepo *repository.DocumentRepository,
	ollamaService *OllamaService,
	ttsService *TTSService,
	cloudinaryService *CloudinaryService,
) *AuditPipelineService {
	return &AuditPipelineService{
		documentRepo:      documentRepo,
		ollamaService:     ollamaService,
		ttsService:        ttsService,
		cloudinaryService: cloudinaryService,
		httpClient: &http.Client{
			Timeout: 90 * time.Second,
		},
	}
}

func (s *AuditPipelineService) OllamaService() *OllamaService {
	return s.ollamaService
}

func (s *AuditPipelineService) ProcessDocument(documentID uint, roundNumber int) error {
	if err := s.process(documentID, roundNumber); err != nil {
		// Check current status — if already set to "rejected" by quality check, don't overwrite it.
		doc, fetchErr := s.documentRepo.GetByID(documentID)
		if fetchErr != nil || doc.Status != "rejected" {
			if _, updateErr := s.documentRepo.Update(documentID, map[string]any{"status": "failed"}); updateErr != nil {
				log.Printf("failed to update document %d status to failed: %v", documentID, updateErr)
			}
		}
		return err
	}

	return nil
}

func (s *AuditPipelineService) process(documentID uint, roundNumber int) error {
	doc, err := s.documentRepo.GetByID(documentID)
	if err != nil {
		return fmt.Errorf("fetch document: %w", err)
	}

	fileBytes, err := s.downloadFile(doc.CloudinaryURL)
	if err != nil {
		return fmt.Errorf("download source document: %w", err)
	}

	rawText, err := extractRawText(fileBytes, doc.FileName)
	if err != nil {
		return fmt.Errorf("extract raw text: %w", err)
	}

	if _, err := s.documentRepo.Update(documentID, map[string]any{"raw_text": rawText}); err != nil {
		return fmt.Errorf("store raw text: %w", err)
	}

	// Pre-execution quality check
	qualityResult, qualityErr := s.ollamaService.EvaluateDocumentQuality(rawText)
	if qualityErr != nil {
		log.Printf("Warning: quality check failed for document %d: %v — continuing anyway", documentID, qualityErr)
	} else if qualityResult.Recommendation == "block" {
		score := qualityResult.QualityScore
		s.documentRepo.CreateAuditReport(&models.AuditReport{
			DocumentID:    documentID,
			RoundNumber:   roundNumber,
			QualityScore:  &score,
			QualityIssues: datatypes.JSONMap{"issues": qualityResult.QualityIssues},
			QualityReason: qualityResult.Reason,
		})
		if _, updateErr := s.documentRepo.Update(documentID, map[string]any{"status": "rejected"}); updateErr != nil {
			log.Printf("failed to update document %d status to rejected: %v", documentID, updateErr)
		}
		return fmt.Errorf("document rejected by quality check: %s", qualityResult.Reason)
	}

	transcript, err := s.ollamaService.GenerateDebate(rawText)
	if err != nil {
		return fmt.Errorf("generate debate: %w", err)
	}

	audioBytes, correctedTranscript, err := s.ttsService.GenerateDebateAudio(transcript)
	if err != nil {
		return fmt.Errorf("generate debate audio: %w", err)
	}

	audioURL, err := s.cloudinaryService.UploadBytes(audioBytes, "audio_debates", fmt.Sprintf("debate-%d-%d", documentID, time.Now().Unix()))
	if err != nil {
		return fmt.Errorf("upload debate audio: %w", err)
	}

	transcriptJSON, err := json.Marshal(correctedTranscript)
	if err != nil {
		return fmt.Errorf("marshal transcript: %w", err)
	}

	debate := &models.AudioDebate{
		DocumentID:         documentID,
		RoundNumber:        roundNumber,
		CloudinaryAudioURL: audioURL,
		TranscriptJSON:     datatypes.JSON(transcriptJSON),
	}

	if err := s.documentRepo.CreateAudioDebate(debate); err != nil {
		return fmt.Errorf("create audio debate record: %w", err)
	}

	auditResult, err := s.ollamaService.GenerateAuditReport(rawText)
	if err != nil {
		log.Printf("Warning: audit report generation failed for document %d: %v", documentID, err)
		auditResult = nil
	}

	if auditResult != nil {
		vulnJSON, vulnErr := json.Marshal(auditResult.Vulnerabilities)
		fallacyJSON, fallacyErr := json.Marshal(auditResult.LogicalFallacies)
		sectionJSON, sectionErr := json.Marshal(auditResult.DocumentSections)

		if vulnErr != nil || fallacyErr != nil {
			log.Printf(
				"Warning: failed to marshal audit report components for document %d (vuln=%v fallacies=%v)",
				documentID,
				vulnErr,
				fallacyErr,
			)
		} else {
			if sectionErr != nil {
				sectionJSON = []byte("[]")
			}
			auditReport := &models.AuditReport{
				DocumentID:          documentID,
				RoundNumber:         roundNumber,
				ResilienceScore:     &auditResult.ResilienceScore,
				ResilienceRationale: auditResult.ResilienceRationale,
				SectionScores:       datatypes.JSON(sectionJSON),
				HeatmapData:         datatypes.JSONMap{"segments": auditResult.HeatmapData},
				Vulnerabilities:     datatypes.JSON(vulnJSON),
				LogicalFallacies:    datatypes.JSON(fallacyJSON),
				FortificationPlan:   datatypes.JSONMap{"steps": auditResult.FortificationPlan},
			}
			if qualityResult != nil {
				score := qualityResult.QualityScore
				auditReport.QualityScore = &score
				auditReport.QualityIssues = datatypes.JSONMap{"issues": qualityResult.QualityIssues}
				auditReport.QualityReason = qualityResult.Reason
			}

			if createErr := s.documentRepo.CreateAuditReport(auditReport); createErr != nil {
				log.Printf("Warning: failed to store audit report for document %d: %v", documentID, createErr)
			}
		}
	}

	if _, err := s.documentRepo.Update(documentID, map[string]any{"status": "processed"}); err != nil {
		return fmt.Errorf("set document processed status: %w", err)
	}

	if err := s.documentRepo.IncrementAuditsPerformed(doc.UserID); err != nil {
		log.Printf("Warning: failed to increment usage for user %d: %v", doc.UserID, err)
	}

	return nil
}

func (s *AuditPipelineService) downloadFile(url string) ([]byte, error) {
	resp, err := s.httpClient.Get(url)
	if err != nil {
		return nil, fmt.Errorf("http get failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("http get returned status %d", resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read response body: %w", err)
	}

	if len(body) == 0 {
		return nil, fmt.Errorf("downloaded empty file")
	}

	return body, nil
}

func extractRawText(fileBytes []byte, fileName string) (string, error) {
	ext := strings.ToLower(filepath.Ext(fileName))
	switch ext {
	case ".txt":
		return strings.TrimSpace(string(fileBytes)), nil
	case ".pdf":
		return extractPDFText(fileBytes)
	case ".docx":
		return extractDOCXText(fileBytes)
	default:
		return "", fmt.Errorf("unsupported file type: %s", ext)
	}
}

func extractPDFText(fileBytes []byte) (string, error) {
	tmpFile, err := os.CreateTemp("", "ares-*.pdf")
	if err != nil {
		return "", fmt.Errorf("create temp PDF file: %w", err)
	}
	tmpPath := tmpFile.Name()
	defer os.Remove(tmpPath)

	if _, err := tmpFile.Write(fileBytes); err != nil {
		tmpFile.Close()
		return "", fmt.Errorf("write temp PDF file: %w", err)
	}

	if err := tmpFile.Close(); err != nil {
		return "", fmt.Errorf("close temp PDF file: %w", err)
	}

	f, reader, err := pdf.Open(tmpPath)
	if err != nil {
		return "", fmt.Errorf("open PDF: %w", err)
	}
	defer f.Close()

	plainText, err := reader.GetPlainText()
	if err != nil {
		return "", fmt.Errorf("extract PDF plain text: %w", err)
	}

	textBytes, err := io.ReadAll(plainText)
	if err != nil {
		return "", fmt.Errorf("read extracted PDF text: %w", err)
	}

	text := strings.TrimSpace(string(textBytes))
	if text == "" {
		return "", fmt.Errorf("extracted empty text from PDF")
	}

	return text, nil
}

func extractDOCXText(fileBytes []byte) (string, error) {
	readerAt := bytes.NewReader(fileBytes)
	zr, err := zip.NewReader(readerAt, int64(len(fileBytes)))
	if err != nil {
		return "", fmt.Errorf("open docx zip: %w", err)
	}

	var documentXML []byte
	for _, f := range zr.File {
		if f.Name != "word/document.xml" {
			continue
		}
		rc, err := f.Open()
		if err != nil {
			return "", fmt.Errorf("open word/document.xml: %w", err)
		}
		documentXML, err = io.ReadAll(rc)
		rc.Close()
		if err != nil {
			return "", fmt.Errorf("read word/document.xml: %w", err)
		}
		break
	}

	if len(documentXML) == 0 {
		return "", fmt.Errorf("word/document.xml not found in docx")
	}

	decoder := xml.NewDecoder(bytes.NewReader(documentXML))
	var textBuilder strings.Builder

	for {
		tok, err := decoder.Token()
		if err == io.EOF {
			break
		}
		if err != nil {
			return "", fmt.Errorf("parse docx xml: %w", err)
		}

		if charData, ok := tok.(xml.CharData); ok {
			segment := strings.TrimSpace(string(charData))
			if segment != "" {
				if textBuilder.Len() > 0 {
					textBuilder.WriteString("\n")
				}
				textBuilder.WriteString(segment)
			}
		}
	}

	text := strings.TrimSpace(textBuilder.String())
	if text == "" {
		return "", fmt.Errorf("extracted empty text from DOCX")
	}

	return text, nil
}
