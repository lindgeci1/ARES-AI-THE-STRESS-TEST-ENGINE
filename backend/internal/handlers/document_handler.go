package handlers

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"strconv"
	"time"

	"ares-ai-backend/internal/repository"
	"ares-ai-backend/internal/service"

	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
)

// DocumentHandler handles HTTP requests for document-related endpoints
type DocumentHandler struct {
	service         *service.DocumentService
	pipelineService *service.AuditPipelineService
	jobQueue        *service.JobQueueService
	userRepo        *repository.UserRepository
}

// NewDocumentHandler creates a new document handler
func NewDocumentHandler(svc *service.DocumentService, pipelineService *service.AuditPipelineService, jobQueue *service.JobQueueService, userRepo *repository.UserRepository) *DocumentHandler {
	return &DocumentHandler{service: svc, pipelineService: pipelineService, jobQueue: jobQueue, userRepo: userRepo}
}

// extractJWTClaims extracts user info from JWT claims
func extractJWTClaims(c *fiber.Ctx) (userID uint, role string, err error) {
	claims := c.Locals("jwt_claims")
	if claims == nil {
		err = fiber.NewError(fiber.StatusUnauthorized, "No JWT claims found")
		return
	}

	jwtClaims, ok := claims.(jwt.MapClaims)
	if !ok {
		err = fiber.NewError(fiber.StatusUnauthorized, "Invalid JWT claims")
		return
	}

	userIDFloat, ok := jwtClaims["user_id"].(float64)
	if !ok {
		err = fiber.NewError(fiber.StatusUnauthorized, "Invalid user_id in token")
		return
	}
	userID = uint(userIDFloat)

	role, ok = jwtClaims["role"].(string)
	if !ok {
		err = fiber.NewError(fiber.StatusUnauthorized, "Invalid role in token")
		return
	}

	return
}

// CreateDocument handles document creation with file upload
// @Summary Create document with file upload
// @Description Create a new document and upload file to Cloudinary
// @Tags Documents
// @Accept multipart/form-data
// @Produce json
// @Param file formData file true "Document file"
// @Success 201 {object} models.Document
// @Failure 400 {object} map[string]string
// @Failure 403 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /documents [post]
func (h *DocumentHandler) CreateDocument(c *fiber.Ctx) error {
	// Parse multipart form
	file, err := c.FormFile("file")
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "File is required",
		})
	}

	// Get user_id from JWT claims, NOT from request
	claims := c.Locals("jwt_claims")
	if claims == nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": "No JWT claims found",
		})
	}

	jwtClaims, ok := claims.(jwt.MapClaims)
	if !ok {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": "Invalid JWT claims",
		})
	}

	userIDFloat, ok := jwtClaims["user_id"].(float64)
	if !ok {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": "Invalid user_id in token",
		})
	}
	userID := uint(userIDFloat)

	// Upload and create document
	doc, err := h.service.CreateDocumentWithUpload(userID, file.Filename, file)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": err.Error(),
		})
	}

	if h.jobQueue != nil {
		h.jobQueue.EnqueueAuditJob(doc.ID, 1)
	}

	return c.Status(fiber.StatusCreated).JSON(doc)
}

// GetAllDocuments retrieves all documents (admin)
// @Summary Get all documents
// @Description Retrieve all documents in the system
// @Tags Documents
// @Produce json
// @Success 200 {array} models.Document
// @Failure 500 {object} map[string]string
// @Router /documents [get]
func (h *DocumentHandler) GetAllDocuments(c *fiber.Ctx) error {
	docs, err := h.service.GetAllDocuments()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": err.Error(),
		})
	}

	return c.JSON(docs)
}

func (h *DocumentHandler) GetAllAudioDebates(c *fiber.Ctx) error {
	debates, err := h.service.GetAllAudioDebates()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": err.Error(),
		})
	}

	return c.JSON(debates)
}

// GetDocumentByID retrieves a specific document
// @Summary Get document by ID
// @Description Retrieve a single document's details (users can only see their own, admins can see any)
// @Tags Documents
// @Produce json
// @Param id path int true "Document ID"
// @Success 200 {object} models.Document
// @Failure 400 {object} map[string]string
// @Failure 403 {object} map[string]string
// @Failure 404 {object} map[string]string
// @Router /documents/{id} [get]
func (h *DocumentHandler) GetDocumentByID(c *fiber.Ctx) error {
	// Extract user info from JWT
	requestingUserID, role, err := extractJWTClaims(c)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": err.Error(),
		})
	}

	idParam := c.Params("id")
	idInt, err := strconv.ParseUint(idParam, 10, 32)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid document ID",
		})
	}
	id := uint(idInt)

	doc, err := h.service.GetDocument(id)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"error": err.Error(),
		})
	}

	// Permission check: Users can only see their own documents, Admins can see any
	if role != "Admin" && requestingUserID != doc.UserID {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"error": "Forbidden: You can only view your own documents",
		})
	}

	return c.JSON(doc)
}

// GetUserDocuments retrieves all documents for a user
// @Summary Get user documents
// @Description Retrieve documents for the current user (users see only their own, admins can request any user)
// @Tags Documents
// @Produce json
// @Param userId path int false "User ID (optional for admins)"
// @Success 200 {array} models.Document
// @Failure 400 {object} map[string]string
// @Failure 403 {object} map[string]string
// @Router /documents/user/{userId} [get]
func (h *DocumentHandler) GetUserDocuments(c *fiber.Ctx) error {
	// Get requesting user info from JWT claims
	claims := c.Locals("jwt_claims")
	if claims == nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": "No JWT claims found",
		})
	}

	jwtClaims, ok := claims.(jwt.MapClaims)
	if !ok {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": "Invalid JWT claims",
		})
	}

	role, ok := jwtClaims["role"].(string)
	if !ok {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": "Invalid role in token",
		})
	}

	requestingUserIDFloat, ok := jwtClaims["user_id"].(float64)
	if !ok {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": "Invalid user_id in token",
		})
	}
	requestingUserID := uint(requestingUserIDFloat)

	// Get requested user ID from URL
	userIDParam := c.Params("userId")
	userIDInt, err := strconv.ParseUint(userIDParam, 10, 32)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid user ID",
		})
	}
	requestUserID := uint(userIDInt)

	// Permission check: Users can only see their own documents, Admins can see any
	if role != "Admin" && requestingUserID != requestUserID {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"error": "Forbidden: You can only view your own documents",
		})
	}

	docs, err := h.service.GetUserDocuments(requestUserID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": err.Error(),
		})
	}

	return c.JSON(docs)
}

// UpdateDocument updates a document
// @Summary Update document
// @Description Update document information (users can only update their own, admins can update any)
// @Tags Documents
// @Accept json
// @Produce json
// @Param id path int true "Document ID"
// @Param request body models.UpdateDocumentRequest true "Update details"
// @Success 200 {object} models.Document
// @Failure 400 {object} map[string]string
// @Failure 403 {object} map[string]string
// @Failure 404 {object} map[string]string
// @Router /documents/{id} [put]
func (h *DocumentHandler) UpdateDocument(c *fiber.Ctx) error {
	// Extract user info from JWT
	requestingUserID, role, err := extractJWTClaims(c)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": err.Error(),
		})
	}

	idParam := c.Params("id")
	idInt, err := strconv.ParseUint(idParam, 10, 32)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid document ID",
		})
	}
	id := uint(idInt)

	// Check ownership before allowing update
	doc, err := h.service.GetDocument(id)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"error": err.Error(),
		})
	}

	if role != "Admin" && requestingUserID != doc.UserID {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"error": "Forbidden: You can only update your own documents",
		})
	}

	var req struct {
		FileName *string `json:"file_name,omitempty"`
		Status   *string `json:"status,omitempty"`
	}

	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid request body",
		})
	}

	updatedDoc, err := h.service.UpdateDocument(id, req.FileName, req.Status)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": err.Error(),
		})
	}

	return c.JSON(updatedDoc)
}

// DeleteDocument deletes a document
// @Summary Delete document
// @Description Remove a document (users can only delete their own, admins can delete any)
// @Tags Documents
// @Produce json
// @Param id path int true "Document ID"
// @Success 200 {object} map[string]string
// @Failure 400 {object} map[string]string
// @Failure 403 {object} map[string]string
// @Failure 404 {object} map[string]string
// @Router /documents/{id} [delete]
func (h *DocumentHandler) DeleteDocument(c *fiber.Ctx) error {
	// Extract user info from JWT
	requestingUserID, role, err := extractJWTClaims(c)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": err.Error(),
		})
	}

	idParam := c.Params("id")
	idInt, err := strconv.ParseUint(idParam, 10, 32)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid document ID",
		})
	}
	id := uint(idInt)

	// Check ownership before allowing delete
	doc, err := h.service.GetDocument(id)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"error": err.Error(),
		})
	}

	if role != "Admin" && requestingUserID != doc.UserID {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"error": "Forbidden: You can only delete your own documents",
		})
	}

	if err := h.service.DeleteDocument(id); err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
			"error": err.Error(),
		})
	}

	return c.JSON(fiber.Map{
		"message": "Document deleted successfully",
	})
}

// ArchiveDocument toggles a document's status between "archived" and "processed"
func (h *DocumentHandler) ArchiveDocument(c *fiber.Ctx) error {
	requestingUserID, role, err := extractJWTClaims(c)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": err.Error()})
	}

	idParam := c.Params("id")
	idInt, err := strconv.ParseUint(idParam, 10, 32)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid document ID"})
	}
	id := uint(idInt)

	doc, err := h.service.GetDocument(id)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Document not found"})
	}

	if role != "Admin" && doc.UserID != requestingUserID {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Forbidden"})
	}

	newStatus := "archived"
	if doc.Status == "archived" {
		newStatus = "processed"
	}

	updated, err := h.service.UpdateDocument(id, nil, &newStatus)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(updated)
}

// ReAuditDocument handles re-auditing with an updated document
// PUT /api/v1/documents/:id/reaudit
func (h *DocumentHandler) ReAuditDocument(c *fiber.Ctx) error {
	requestingUserID, role, err := extractJWTClaims(c)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": err.Error()})
	}

	idParam := c.Params("id")
	idInt, err := strconv.ParseUint(idParam, 10, 32)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid document ID"})
	}
	docID := uint(idInt)

	doc, err := h.service.GetDocument(docID)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Document not found"})
	}

	if role != "Admin" && doc.UserID != requestingUserID {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Forbidden"})
	}

	if h.userRepo == nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "User repository not configured"})
	}

	usage, err := h.userRepo.GetUserUsage(doc.UserID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to load user usage"})
	}

	if doc.RoundsUsed >= usage.RoundsPerAudit {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Maximum rounds reached for this document. Upgrade your plan."})
	}

	file, err := c.FormFile("file")
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "File is required"})
	}

	cloudinaryURL, err := h.service.UploadDocumentFile(file)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	newRound := doc.RoundsUsed + 1

	updates := map[string]interface{}{
		"cloudinary_url": cloudinaryURL,
		"file_name":      file.Filename,
		"raw_text":       nil,
		"status":         "pending",
		"rounds_used":    newRound,
	}

	updatedDoc, err := h.service.UpdateDocumentWithFields(docID, updates)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}

	if h.jobQueue != nil {
		h.jobQueue.EnqueueAuditJob(updatedDoc.ID, newRound)
	}

	return c.JSON(updatedDoc)
}

// CompareDocuments compares multiple documents using AI.
// POST /api/v1/documents/compare
func (h *DocumentHandler) CompareDocuments(c *fiber.Ctx) error {
	requestingUserID, role, err := extractJWTClaims(c)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": err.Error()})
	}

	var req struct {
		DocumentIDs []uint `json:"document_ids"`
	}
	if err := c.BodyParser(&req); err != nil || len(req.DocumentIDs) < 2 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Provide at least 2 document_ids"})
	}
	if len(req.DocumentIDs) > 4 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Maximum 4 documents allowed"})
	}

	if h.pipelineService == nil {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{"error": "Pipeline not available"})
	}

	var summaries []service.DocumentSummaryForComparison
	for _, docID := range req.DocumentIDs {
		doc, err := h.service.GetDocument(docID)
		if err != nil {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": fmt.Sprintf("Document %d not found", docID)})
		}
		if role != "Admin" && doc.UserID != requestingUserID {
			return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": fmt.Sprintf("Document %d not accessible", docID)})
		}
		if doc.Status != "processed" {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": fmt.Sprintf("Document %d has not been processed yet", docID)})
		}

		score := 0
		vulnCount := 0
		fallacyCount := 0
		rationale := ""

		if len(doc.AuditReports) > 0 {
			latest := doc.AuditReports[len(doc.AuditReports)-1]
			if latest.ResilienceScore != nil {
				score = *latest.ResilienceScore
			}
			rationale = latest.ResilienceRationale

			var vulnArr []map[string]any
			if json.Unmarshal([]byte(latest.Vulnerabilities), &vulnArr) == nil {
				vulnCount = len(vulnArr)
			}
			var fallacyArr []map[string]any
			if json.Unmarshal([]byte(latest.LogicalFallacies), &fallacyArr) == nil {
				fallacyCount = len(fallacyArr)
			}
		}

		summaries = append(summaries, service.DocumentSummaryForComparison{
			Title:           doc.FileName,
			ResilienceScore: score,
			Vulnerabilities: vulnCount,
			Fallacies:       fallacyCount,
			Rationale:       rationale,
		})
	}

	ollamaSvc := h.pipelineService.OllamaService()
	result, err := ollamaSvc.GenerateComparison(summaries)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Comparison generation failed: " + err.Error()})
	}

	return c.JSON(fiber.Map{
		"comparison": result,
		"documents":  summaries,
	})
}

// StreamDocumentEvents opens a Server-Sent Events stream for a document.
// The client receives a single event ("done" or "failed") when the audit job completes,
// then the stream closes. Times out after 10 minutes if no job completes.
// GET /api/v1/documents/:id/events
func (h *DocumentHandler) StreamDocumentEvents(c *fiber.Ctx) error {
	requestingUserID, role, err := extractJWTClaims(c)
	if err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"error": err.Error()})
	}

	idParam := c.Params("id")
	idInt, err := strconv.ParseUint(idParam, 10, 32)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid document ID"})
	}
	docID := uint(idInt)

	doc, err := h.service.GetDocument(docID)
	if err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Document not found"})
	}
	if role != "Admin" && doc.UserID != requestingUserID {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Forbidden"})
	}

	// If document already finished, send event immediately.
	if doc.Status == "processed" || doc.Status == "failed" {
		c.Set("Content-Type", "text/event-stream")
		c.Set("Cache-Control", "no-cache")
		c.Set("Connection", "keep-alive")
		event := "done"
		if doc.Status == "failed" {
			event = "failed"
		}
		return c.SendString(fmt.Sprintf("event: %s\ndata: %s\n\n", event, doc.Status))
	}

	if h.jobQueue == nil {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{"error": "Job queue not available"})
	}

	ch := h.jobQueue.Subscribe(docID)
	defer h.jobQueue.Unsubscribe(docID, ch)

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Minute)
	defer cancel()

	c.Set("Content-Type", "text/event-stream")
	c.Set("Cache-Control", "no-cache")
	c.Set("Connection", "keep-alive")
	c.Set("X-Accel-Buffering", "no")

	c.Context().SetBodyStreamWriter(func(w *bufio.Writer) {
		ticker := time.NewTicker(15 * time.Second)
		defer ticker.Stop()

		for {
			select {
			case event, ok := <-ch:
				if !ok {
					return
				}
				fmt.Fprintf(w, "event: %s\ndata: %s\n\n", event, event)
				w.Flush()
				return
			case <-ticker.C:
				fmt.Fprintf(w, ": heartbeat\n\n")
				w.Flush()
			case <-ctx.Done():
				fmt.Fprintf(w, "event: timeout\ndata: timeout\n\n")
				w.Flush()
				return
			}
		}
	})

	return nil
}
