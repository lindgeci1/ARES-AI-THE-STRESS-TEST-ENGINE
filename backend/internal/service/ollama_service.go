package service

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"
)

type DebateEntry struct {
	Role string `json:"role"`
	Text string `json:"text"`
	Time string `json:"time"`
}

type DocumentSection struct {
	SectionName      string `json:"section_name"`
	SectionScore     int    `json:"section_score"`
	SectionRationale string `json:"section_rationale"`
}

type AuditReportResult struct {
	ResilienceScore     int                 `json:"resilience_score"`
	ResilienceRationale string              `json:"resilience_rationale"`
	DocumentSections    []DocumentSection   `json:"document_sections"`
	HeatmapData         []HeatmapSegment    `json:"heatmap_data"`
	Vulnerabilities     []Vulnerability     `json:"vulnerabilities"`
	LogicalFallacies    []LogicalFallacy    `json:"logical_fallacies"`
	FortificationPlan   []FortificationStep `json:"fortification_plan"`
}

type HeatmapSegment struct {
	Text string `json:"text"`
	Heat string `json:"heat"`
	Note string `json:"note,omitempty"`
}

type Vulnerability struct {
	ID        string `json:"id"`
	Severity  string `json:"severity"`
	Section   string `json:"section"`
	Title     string `json:"title"`
	Detail    string `json:"detail"`
	Precedent string `json:"precedent,omitempty"`
}

type LogicalFallacy struct {
	ID       string `json:"id"`
	Type     string `json:"type"`
	Sections string `json:"sections"`
	Title    string `json:"title"`
	Detail   string `json:"detail"`
}

type FortificationStep struct {
	Step     string   `json:"step"`
	Priority string   `json:"priority"`
	Title    string   `json:"title"`
	Fixes    []string `json:"fixes"`
	Action   string   `json:"action"`
	Effort   string   `json:"effort"`
	Impact   string   `json:"impact"`
}

type OllamaService struct {
	apiKey     string
	httpClient *http.Client
}

func NewOllamaService() *OllamaService {
	return &OllamaService{
		apiKey: os.Getenv("OLLAMA_API_KEY"),
		httpClient: &http.Client{
			Timeout: 90 * time.Second,
		},
	}
}

func (s *OllamaService) GenerateDebate(rawText string) ([]DebateEntry, error) {
	if strings.TrimSpace(s.apiKey) == "" {
		return nil, fmt.Errorf("OLLAMA_API_KEY environment variable not set")
	}

	const maxChars = 20000
	if len(rawText) > maxChars {
		rawText = rawText[:maxChars]
	}

	if strings.TrimSpace(rawText) == "" {
		return nil, fmt.Errorf("raw text is empty")
	}

	systemPrompt := debateSystemPrompt()
	payload := map[string]any{
		"model": "gpt-oss:20b-cloud",
		"messages": []map[string]string{
			{
				"role":    "system",
				"content": systemPrompt,
			},
			{
				"role":    "user",
				"content": rawText,
			},
		},
		"stream": false,
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("marshal Ollama payload: %w", err)
	}

	req, err := http.NewRequest(http.MethodPost, "https://ollama.com/api/chat", bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("create Ollama request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+s.apiKey)

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("call Ollama API: %w", err)
	}
	defer resp.Body.Close()

	respBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read Ollama response: %w", err)
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("Ollama API returned %d: %s", resp.StatusCode, strings.TrimSpace(string(respBytes)))
	}

	var ollamaResp struct {
		Message struct {
			Role    string `json:"role"`
			Content string `json:"content"`
		} `json:"message"`
	}
	if err := json.Unmarshal(respBytes, &ollamaResp); err != nil {
		return nil, fmt.Errorf("parse Ollama response: %w", err)
	}

	jsonText := strings.TrimSpace(ollamaResp.Message.Content)
	if jsonText == "" {
		return nil, fmt.Errorf("Ollama returned empty message content")
	}

	jsonText = stripMarkdownFence(jsonText)

	transcript, err := parseDebateTranscript(jsonText)
	if err != nil {
		return nil, fmt.Errorf("parse debate JSON: %w", err)
	}

	return transcript, nil
}

func (s *OllamaService) GenerateAuditReport(rawText string) (*AuditReportResult, error) {
	if strings.TrimSpace(s.apiKey) == "" {
		return nil, fmt.Errorf("OLLAMA_API_KEY environment variable not set")
	}

	const maxChars = 20000
	if len(rawText) > maxChars {
		rawText = rawText[:maxChars]
	}

	if strings.TrimSpace(rawText) == "" {
		return nil, fmt.Errorf("raw text is empty")
	}

	payload := map[string]any{
		"model": "gpt-oss:20b-cloud",
		"messages": []map[string]string{
			{
				"role":    "system",
				"content": auditReportSystemPrompt(),
			},
			{
				"role":    "user",
				"content": rawText,
			},
		},
		"stream": false,
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("marshal Ollama payload: %w", err)
	}

	req, err := http.NewRequest(http.MethodPost, "https://ollama.com/api/chat", bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("create Ollama request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+s.apiKey)

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("call Ollama API: %w", err)
	}
	defer resp.Body.Close()

	respBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read Ollama response: %w", err)
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("Ollama API returned %d: %s", resp.StatusCode, strings.TrimSpace(string(respBytes)))
	}

	var ollamaResp struct {
		Message struct {
			Role    string `json:"role"`
			Content string `json:"content"`
		} `json:"message"`
	}
	if err := json.Unmarshal(respBytes, &ollamaResp); err != nil {
		return nil, fmt.Errorf("parse Ollama response: %w", err)
	}

	jsonText := strings.TrimSpace(ollamaResp.Message.Content)
	if jsonText == "" {
		return nil, fmt.Errorf("Ollama returned empty message content")
	}

	jsonText = stripMarkdownFence(jsonText)

	result := &AuditReportResult{}
	if err := json.Unmarshal([]byte(jsonText), result); err != nil {
		return nil, fmt.Errorf("parse audit report JSON: %w", err)
	}

	return result, nil
}

type ComparisonDimensionScore struct {
	Dimension string         `json:"dimension"`
	Scores    map[string]int `json:"scores"`
}

type ComparisonResult struct {
	Winner            string                    `json:"winner"`
	ComparisonSummary string                    `json:"comparison_summary"`
	DimensionScores   []ComparisonDimensionScore `json:"dimension_scores"`
	UniqueStrengths   map[string]string         `json:"unique_strengths"`
	UniqueWeaknesses  map[string]string         `json:"unique_weaknesses"`
}

type DocumentSummaryForComparison struct {
	Title           string `json:"title"`
	ResilienceScore int    `json:"resilience_score"`
	Vulnerabilities int    `json:"vulnerability_count"`
	Fallacies       int    `json:"fallacy_count"`
	Rationale       string `json:"rationale"`
}

func (s *OllamaService) GenerateComparison(docs []DocumentSummaryForComparison) (*ComparisonResult, error) {
	if strings.TrimSpace(s.apiKey) == "" {
		return nil, fmt.Errorf("OLLAMA_API_KEY environment variable not set")
	}

	summaryJSON, err := json.Marshal(docs)
	if err != nil {
		return nil, fmt.Errorf("marshal comparison input: %w", err)
	}

	systemPrompt := `You are an expert document analyst. You will receive an array of document summaries and must compare them.

Return ONLY a valid JSON object with NO markdown, NO backticks:
{
  "winner": "exact document title of the strongest document",
  "comparison_summary": "2-3 plain English sentences summarizing how the documents compare overall",
  "dimension_scores": [
    {"dimension": "Argument Strength", "scores": {"<title1>": 0-100, "<title2>": 0-100}},
    {"dimension": "Structural Clarity", "scores": {"<title1>": 0-100, "<title2>": 0-100}},
    {"dimension": "Evidence Quality", "scores": {"<title1>": 0-100, "<title2>": 0-100}},
    {"dimension": "Logical Consistency", "scores": {"<title1>": 0-100, "<title2>": 0-100}}
  ],
  "unique_strengths": {"<title1>": "one sentence strength", "<title2>": "one sentence strength"},
  "unique_weaknesses": {"<title1>": "one sentence weakness", "<title2>": "one sentence weakness"}
}

Use the exact document titles as keys. Base scores on the resilience score, vulnerability count, fallacy count, and rationale provided.`

	payload := map[string]any{
		"model": "gpt-oss:20b-cloud",
		"messages": []map[string]string{
			{"role": "system", "content": systemPrompt},
			{"role": "user", "content": string(summaryJSON)},
		},
		"stream": false,
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("marshal payload: %w", err)
	}

	req, err := http.NewRequest(http.MethodPost, "https://ollama.com/api/chat", bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+s.apiKey)

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("call API: %w", err)
	}
	defer resp.Body.Close()

	respBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read response: %w", err)
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("API returned %d: %s", resp.StatusCode, strings.TrimSpace(string(respBytes)))
	}

	var ollamaResp struct {
		Message struct {
			Content string `json:"content"`
		} `json:"message"`
	}
	if err := json.Unmarshal(respBytes, &ollamaResp); err != nil {
		return nil, fmt.Errorf("parse response: %w", err)
	}

	jsonText := stripMarkdownFence(strings.TrimSpace(ollamaResp.Message.Content))

	result := &ComparisonResult{}
	if err := json.Unmarshal([]byte(jsonText), result); err != nil {
		return nil, fmt.Errorf("parse comparison JSON: %w", err)
	}

	return result, nil
}

type DocumentQualityResult struct {
	QualityScore    int      `json:"quality_score"`
	QualityIssues   []string `json:"quality_issues"`
	Recommendation  string   `json:"recommendation"`
	Reason          string   `json:"reason"`
}

func (s *OllamaService) EvaluateDocumentQuality(extractedText string) (*DocumentQualityResult, error) {
	if strings.TrimSpace(s.apiKey) == "" {
		return nil, fmt.Errorf("OLLAMA_API_KEY environment variable not set")
	}

	const maxChars = 5000
	text := extractedText
	if len(text) > maxChars {
		text = text[:maxChars]
	}

	systemPrompt := `You are a document quality evaluator. Evaluate the provided text and return ONLY a valid JSON object with NO markdown, NO backticks:
{
  "quality_score": integer 0-100,
  "quality_issues": ["issue1", "issue2"],
  "recommendation": "proceed" | "warn" | "block",
  "reason": "one sentence plain English reason"
}

Rules:
- "block" if: fewer than 200 words, text is random/incoherent gibberish, language is unsupported (not English or major world language)
- "warn" if: no auditable claims or arguments, very repetitive content, appears to be a template with placeholders
- "proceed" if: the document is a real substantive document with auditable content
- quality_score: 0-30 = block range, 31-60 = warn range, 61-100 = proceed range
- quality_issues: list specific problems found, empty array if none
Return ONLY the JSON object.`

	payload := map[string]any{
		"model": "gpt-oss:20b-cloud",
		"messages": []map[string]string{
			{"role": "system", "content": systemPrompt},
			{"role": "user", "content": text},
		},
		"stream": false,
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("marshal quality check payload: %w", err)
	}

	req, err := http.NewRequest(http.MethodPost, "https://ollama.com/api/chat", bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("create quality check request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+s.apiKey)

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("call Ollama API for quality check: %w", err)
	}
	defer resp.Body.Close()

	respBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read quality check response: %w", err)
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("Ollama API returned %d: %s", resp.StatusCode, strings.TrimSpace(string(respBytes)))
	}

	var ollamaResp struct {
		Message struct {
			Content string `json:"content"`
		} `json:"message"`
	}
	if err := json.Unmarshal(respBytes, &ollamaResp); err != nil {
		return nil, fmt.Errorf("parse quality check Ollama response: %w", err)
	}

	jsonText := stripMarkdownFence(strings.TrimSpace(ollamaResp.Message.Content))

	result := &DocumentQualityResult{}
	if err := json.Unmarshal([]byte(jsonText), result); err != nil {
		return nil, fmt.Errorf("parse quality check JSON: %w", err)
	}

	return result, nil
}

func debateSystemPrompt() string {
	return `You are orchestrating an AI debate about a document.

Rules:
- Act as two agents: AUDITOR and OPTIMIST.
- AUDITOR is red-team and aggressive, focused on vulnerabilities.
- OPTIMIST is blue-team and defensive, focused on strengths.
- Conduct exactly 3 rounds.
- In each round this order must be followed:
  1) AUDITOR attacks
  2) OPTIMIST defends
  3) SYSTEM announces round result
- Start with one SYSTEM entry announcing audit initiation.
- Return ONLY a valid JSON array.
- Do not include markdown or backticks.
- Every item must be exactly:
  {"role":"AUDITOR"|"OPTIMIST"|"SYSTEM","text":"...","time":"HH:MM:SS"}
- Times must be sequential and start from 00:00:00.`
}

func auditReportSystemPrompt() string {
	return `You are an expert legal and document auditor. Analyze the provided document text and return a comprehensive audit report as a single JSON object with NO markdown, NO backticks, NO explanation - ONLY valid JSON.

The JSON must have exactly these fields:

1. "document_sections": array of objects. Identify the natural named sections of the document (e.g. Introduction, Data Collection, Liability, Termination — use the actual section names or headings present). For each section: {"section_name": "exact section name", "section_score": integer 0-100 how well this section would survive scrutiny, "section_rationale": "one sentence explaining the score"}. Score every identifiable section. The overall resilience_score must equal the weighted average of these section scores, where longer sections carry proportionally more weight.

2. "resilience_score": integer 0-100. The weighted average of all document_sections scores (longer sections weighted more). Below 40 = CRITICAL, 40-69 = MODERATE, 70+ = RESILIENT.

3. "resilience_rationale": string. 2-3 plain English sentences explaining exactly why the document received this score. Reference the specific vulnerabilities, missing clauses, or strengths that had the most influence on the score. Be direct and specific — name the actual issues.

4. "heatmap_data": array of objects. Break the document into logical segments (sentences or short paragraphs). Each object: {"text": "exact text from document", "heat": "red|yellow|green|neutral", "note": "brief explanation of why this rating"}. Use "red" for critical vulnerabilities, "yellow" for moderate concerns, "green" for strong/secure clauses, "neutral" for headings/structural text.

5. "vulnerabilities": array of objects. Each: {"id": "VLN-001", "severity": "CRITICAL|HIGH|MODERATE", "section": "Section X - Title", "title": "Short title", "detail": "Detailed explanation of the vulnerability and its legal implications", "precedent": "Relevant legal case or regulation if applicable"}. Find real vulnerabilities - vague language, missing definitions, overreach, compliance gaps.

6. "logical_fallacies": array of objects. Each: {"id": "LF-001", "type": "FALLACY TYPE IN CAPS", "sections": "Section X vs Section Y", "title": "Short title", "detail": "Explanation of the logical inconsistency between clauses"}. Look for contradictions, circular reasoning, scope creep between sections.

7. "fortification_plan": array of objects. Each: {"step": "01", "priority": "CRITICAL|HIGH|MEDIUM", "title": "Short action title", "fixes": ["VLN-001", "LF-001"], "action": "Detailed rewrite instructions", "effort": "HIGH|MEDIUM|LOW", "impact": "What this eliminates"}. Provide actionable fixes ordered by priority.

Return ONLY the JSON object. No wrapping, no explanation.`
}

func stripMarkdownFence(text string) string {
	trimmed := strings.TrimSpace(text)
	if strings.HasPrefix(trimmed, "```") {
		trimmed = strings.TrimPrefix(trimmed, "```json")
		trimmed = strings.TrimPrefix(trimmed, "```")
		if idx := strings.LastIndex(trimmed, "```"); idx >= 0 {
			trimmed = trimmed[:idx]
		}
	}

	return strings.TrimSpace(trimmed)
}

func parseDebateTranscript(text string) ([]DebateEntry, error) {
	var transcript []DebateEntry
	if err := json.Unmarshal([]byte(text), &transcript); err == nil {
		return transcript, nil
	}

	var wrapped struct {
		Transcript []DebateEntry `json:"transcript"`
	}
	if err := json.Unmarshal([]byte(text), &wrapped); err == nil && len(wrapped.Transcript) > 0 {
		return wrapped.Transcript, nil
	}

	return nil, fmt.Errorf("invalid transcript JSON")
}
