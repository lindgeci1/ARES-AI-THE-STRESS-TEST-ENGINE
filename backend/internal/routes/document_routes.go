package routes

import (
	"ares-ai-backend/internal/handlers"
	"ares-ai-backend/internal/middleware"

	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
)

func SetupDocumentRoutes(api fiber.Router, db *gorm.DB, docHandler *handlers.DocumentHandler) {
	documents := api.Group("/documents")
	admin := api.Group("/admin", middleware.RequireRole("Admin"))

	// Document routes require User role
	documents.Post("", middleware.RequireRole("User"), docHandler.CreateDocument)
	documents.Post("/compare", middleware.RequireRole("User"), docHandler.CompareDocuments)
	documents.Get("", middleware.RequireRole("User"), docHandler.GetAllDocuments)
	documents.Get("/:id", middleware.RequireRole("User"), docHandler.GetDocumentByID)
	documents.Get("/user/:userId", middleware.RequireRole("User"), docHandler.GetUserDocuments)
	documents.Put("/:id", middleware.RequireRole("User"), docHandler.UpdateDocument)
	documents.Put("/:id/reaudit", middleware.RequireRole("User"), docHandler.ReAuditDocument)
	documents.Put("/:id/archive", middleware.RequireRole("User"), docHandler.ArchiveDocument)
	documents.Delete("/:id", middleware.RequireRole("User"), docHandler.DeleteDocument)
	documents.Get("/:id/events", middleware.RequireRole("User"), docHandler.StreamDocumentEvents)
	admin.Get("/stats", middleware.RequireRole("Admin"), handlers.GetAdminStats(db))
	admin.Get("/audio-debates", docHandler.GetAllAudioDebates)
}
