package main

import (
	"encoding/json"
	"log"
	"os"

	"ares-ai-backend/internal/handlers"
	"ares-ai-backend/internal/models"
	"ares-ai-backend/internal/repository"
	"ares-ai-backend/internal/routes"
	"ares-ai-backend/internal/service"

	"github.com/stripe/stripe-go/v82"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/joho/godotenv"
	fiberSwagger "github.com/swaggo/fiber-swagger"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	gormLogger "gorm.io/gorm/logger"

	docs "ares-ai-backend/docs" // Import generated docs (alias for runtime config)
)

// @title Ares AI API
// @version 1.0
// @description Stress-Test Engine Backend - AI-powered document analysis and resilience scoring
// @termsOfService http://swagger.io/terms/

// @contact.name API Support
// @contact.email support@ares-ai.com

// @license.name MIT
// @license.url https://opensource.org/licenses/MIT

// @host aresai-backend.bravemoss-81b9af52.germanywestcentral.azurecontainerapps.io
// @BasePath /api/v1
// @schemes https

func main() {
	// Load environment variables from .env file
	if err := godotenv.Load(); err != nil {
		log.Println("Warning: .env file not found, using system environment variables")
	}

	// Configure Swagger host and schemes at runtime from env (overrides generated defaults)
	swaggerHost := os.Getenv("SWAGGER_HOST")
	if swaggerHost == "" {
		swaggerHost = "localhost:3000"
	}
	swaggerScheme := os.Getenv("SWAGGER_SCHEME")
	if swaggerScheme == "" {
		swaggerScheme = "http"
	}
	docs.SwaggerInfo.Host = swaggerHost
	docs.SwaggerInfo.Schemes = []string{swaggerScheme}

	// Initialize Stripe
	stripe.Key = os.Getenv("STRIPE_SECRET_KEY")
	if stripe.Key == "" {
		log.Println("Warning: STRIPE_SECRET_KEY not set — payments will not work")
	} else {
		log.Println("✅ Stripe initialized")
	}

	// Get database URL from environment
	databaseURL := os.Getenv("DATABASE_URL")
	if databaseURL == "" {
		log.Fatal("DATABASE_URL environment variable is not set")
	}

	// Connect to the database using GORM
	db, err := gorm.Open(postgres.Open(databaseURL), &gorm.Config{
		Logger: gormLogger.Default.LogMode(gormLogger.Warn), // Only show warnings and errors
	})
	if err != nil {
		log.Fatalf("Unable to connect to database: %v\n", err)
	}

	log.Println("✅ Successfully connected to the database!")

	// Add new columns if they don't exist yet.
	db.Exec("ALTER TABLE audit_reports ADD COLUMN IF NOT EXISTS resilience_rationale TEXT DEFAULT ''")
	db.Exec("ALTER TABLE audit_reports ADD COLUMN IF NOT EXISTS section_scores JSONB DEFAULT '[]'")
	db.Exec("ALTER TABLE audit_reports ADD COLUMN IF NOT EXISTS quality_score INT")
	db.Exec("ALTER TABLE audit_reports ADD COLUMN IF NOT EXISTS quality_issues JSONB DEFAULT '{}'")
	db.Exec("ALTER TABLE audit_reports ADD COLUMN IF NOT EXISTS quality_reason TEXT DEFAULT ''")

	// Drop old unique indexes so document round history can store multiple rows per document.
	db.Exec("DROP INDEX IF EXISTS idx_audit_reports_document_id")
	db.Exec("DROP INDEX IF EXISTS uni_audit_reports_document_id")
	db.Exec("DROP INDEX IF EXISTS idx_audio_debates_document_id")
	db.Exec("DROP INDEX IF EXISTS uni_audio_debates_document_id")

	// Auto-migrate only tables that are missing so startup does not fail on an
	// already provisioned database.
	if err := migrateMissingTables(db); err != nil {
		log.Fatalf("Migration failed: %v\n", err)
	}

	log.Println("✅ Database migration completed!")

	// Backfill rounds_per_audit for existing rows added before this column existed.
	//db.Exec("UPDATE user_usages SET rounds_per_audit = 3 WHERE rounds_per_audit = 0 OR rounds_per_audit IS NULL")

	// Seed default roles and offers
	seedRoles(db)
	seedOffers(db)

	// Initialize Fiber app
	app := fiber.New(fiber.Config{
		AppName: "Ares AI API v1.0",
	})

	// Middleware
	app.Use(logger.New())
	app.Use(cors.New(cors.Config{
		AllowOrigins:     os.Getenv("CORS_ALLOWED_ORIGINS"),
		AllowHeaders:     "Origin, Content-Type, Accept, Authorization",
		AllowMethods:     "GET, POST, PUT, DELETE, OPTIONS",
		AllowCredentials: true,
	}))

	// Swagger documentation route
	app.Get("/swagger/*", fiberSwagger.WrapHandler)

	// API routes
	api := app.Group("/api/v1")
	api.Get("/public/stats", handlers.GetPublicStats(db))

	// Initialize repositories, services, and handlers
	userRepo := repository.NewUserRepository(db)
	emailService := service.NewEmailService()
	userService := service.NewUserService(userRepo, emailService)
	userHandler := handlers.NewUserHandler(userService)
	resetPasswordRepo := repository.NewResetPasswordRepository(db)
	resetPasswordService := service.NewResetPasswordService(resetPasswordRepo, userRepo, emailService)
	resetPasswordHandler := handlers.NewResetPasswordHandler(resetPasswordService)

	// Initialize Cloudinary service
	cloudinaryService, err := service.NewCloudinaryService()
	if err != nil {
		log.Printf("⚠️  Warning: Cloudinary service not initialized: %v\n", err)
		// Continue without Cloudinary, but file uploads won't work
	}

	docRepo := repository.NewDocumentRepository(db)
	docService := service.NewDocumentServiceWithCloudinary(docRepo, cloudinaryService)

	ollamaService := service.NewOllamaService()
	ttsService, ttsErr := service.NewTTSService()
	if ttsErr != nil {
		log.Printf("⚠️  Warning: TTS service not initialized: %v\n", ttsErr)
	}

	var pipelineService *service.AuditPipelineService
	var jobQueue *service.JobQueueService
	if cloudinaryService != nil && ttsService != nil {
		pipelineService = service.NewAuditPipelineService(docRepo, ollamaService, ttsService, cloudinaryService)
		jobQueue = service.NewJobQueueService(pipelineService)
		log.Println("✅ Job queue initialized")
	} else {
		log.Println("⚠️  Warning: Audit pipeline disabled due to missing dependencies")
	}

	docHandler := handlers.NewDocumentHandler(docService, pipelineService, jobQueue, userRepo)

	offerRepo := repository.NewOfferRepository(db)
	offerService := service.NewOfferService(offerRepo)
	offerHandler := handlers.NewOfferHandler(offerService)

	paymentRepo := repository.NewPaymentRepository(db)
	paymentService := service.NewPaymentService(paymentRepo, offerRepo, userRepo)
	paymentHandler := handlers.NewPaymentHandler(paymentService)

	// Setup routes
	routes.SetupHealthRoutes(api)
	routes.SetupAuthRoutes(api, userHandler, resetPasswordHandler)
	routes.SetupUserRoutes(api, userHandler)
	routes.SetupDocumentRoutes(api, db, docHandler)
	routes.SetupOfferRoutes(api, offerHandler)
	routes.SetupPaymentRoutes(api, paymentHandler)

	// Start server
	port := os.Getenv("PORT")
	if port == "" {
		port = "3000"
	}

	log.Printf("🚀 Ares AI Backend is running on http://localhost:%s\n", port)
	log.Printf("📚 Swagger UI available at http://localhost:%s/swagger/index.html\n", port)

	if err := app.Listen(":" + port); err != nil {
		log.Fatalf("Failed to start server: %v\n", err)
	}
}

func migrateMissingTables(db *gorm.DB) error {
	modelsToMigrate := []interface{}{
		&models.Role{},
		&models.User{},
		&models.RefreshToken{},
		&models.ResetPassword{},
		&models.UserRole{},
		&models.UserUsage{},
		&models.Document{},
		&models.AuditReport{},
		&models.AudioDebate{},
		&models.Payment{},
		&models.Offer{},
	}

	missingTables := make([]interface{}, 0, len(modelsToMigrate))
	for _, model := range modelsToMigrate {
		if !db.Migrator().HasTable(model) {
			missingTables = append(missingTables, model)
		}
	}

	if len(missingTables) == 0 {
		return nil
	}

	return db.AutoMigrate(missingTables...)
}

// seedOffers inserts the default subscription plans if they don't exist yet
func seedOffers(db *gorm.DB) {
	operatorFeatures, _ := json.Marshal([]string{"10 audits / month", "3 rounds per audit", "Basic heatmap analysis", "7-day audit history"})
	strategistFeatures, _ := json.Marshal([]string{"100 audits / month", "10 rounds per audit", "PDF export reports", "90-day audit history"})
	titanFeatures, _ := json.Marshal([]string{"200 audits / month", "20 rounds per audit", "PDF export reports", "Unlimited audit history", "Priority support"})

	offers := []models.Offer{
		{
			ID:             1,
			Name:           "OPERATOR",
			Tier:           1,
			TierLabel:      "TIER 01",
			Price:          0,
			RoundsPerAudit: 3,
			PriceLabel:     "$0",
			PriceSuffix:    "/month",
			Features:       operatorFeatures,
			Color:          "#ffffff",
			IsRecommended:  false,
			IsActive:       true,
			SortOrder:      1,
			CTALabel:       "CURRENT PLAN",
			CTAType:        "none",
			CTALink:        "",
		},
		{
			ID:             2,
			Name:           "STRATEGIST",
			Tier:           2,
			TierLabel:      "TIER 02",
			Price:          49,
			RoundsPerAudit: 10,
			PriceLabel:     "$49",
			PriceSuffix:    "/month",
			Features:       strategistFeatures,
			Color:          "#EF4444",
			IsRecommended:  true,
			IsActive:       true,
			SortOrder:      2,
			CTALabel:       "UPGRADE TO STRATEGIST",
			CTAType:        "link",
			CTALink:        "/checkout/2",
		},
		{
			ID:             3,
			Name:           "TITAN",
			Tier:           3,
			TierLabel:      "TIER 03",
			Price:          100,
			RoundsPerAudit: 20,
			PriceLabel:     "$100",
			PriceSuffix:    "/month",
			Features:       titanFeatures,
			Color:          "#F59E0B",
			IsRecommended:  false,
			IsActive:       true,
			SortOrder:      3,
			CTALabel:       "UPGRADE TO TITAN",
			CTAType:        "link",
			CTALink:        "/checkout/3",
		},
	}

	// Use Save so existing rows get updated (upsert by primary key)
	for _, offer := range offers {
		if err := db.Save(&offer).Error; err != nil {
			log.Printf("Warning: Failed to seed offer %s: %v\n", offer.Name, err)
		}
	}

	// Remove deprecated offer IDs if they exist
	for _, id := range []uint{4} {
		db.Delete(&models.Offer{}, id)
	}

	log.Println("✅ Offers seeded!")
}

// seedRoles ensures the required roles exist in the database
func seedRoles(db *gorm.DB) {
	roles := []models.Role{
		{ID: 1, Name: "Admin", Permissions: models.JSONMap{"manage_users": true, "manage_documents": true, "view_all_reports": true}},
		{ID: 2, Name: "User", Permissions: models.JSONMap{"create_audits": true, "view_own_reports": true}},
	}

	for _, role := range roles {
		if err := db.FirstOrCreate(&role, models.Role{ID: role.ID}).Error; err != nil {
			log.Printf("Warning: Failed to seed role %s: %v\n", role.Name, err)
		}
	}

	log.Println("✅ Roles seeded successfully!")
}
