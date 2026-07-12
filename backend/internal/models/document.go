package models

import (
	"time"

	"gorm.io/datatypes"
)

// Document represents an uploaded document
type Document struct {
	ID            uint          `json:"id" gorm:"primaryKey;autoIncrement"`
	UserID        uint          `json:"user_id" gorm:"not null;index"`
	FileName      string        `json:"file_name" gorm:"type:varchar(255);not null"`
	CloudinaryURL string        `json:"cloudinary_url" gorm:"type:varchar(500)"`
	RawText       *string       `json:"raw_text,omitempty" gorm:"type:text"`
	Status        string        `json:"status" gorm:"type:varchar(50);default:'pending'"`
	RoundsUsed    int           `json:"rounds_used" gorm:"default:1"`
	AuditReports  []AuditReport `json:"audit_reports,omitempty" gorm:"foreignKey:DocumentID;constraint:OnDelete:CASCADE"`
	AudioDebates  []AudioDebate `json:"audio_debates,omitempty" gorm:"foreignKey:DocumentID;constraint:OnDelete:CASCADE"`
	CreatedAt     time.Time     `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt     time.Time     `json:"updated_at" gorm:"autoUpdateTime"`
}

// TableName specifies the table name for Document model
func (Document) TableName() string {
	return "documents"
}

// UpdateDocumentRequest represents the document update payload
type UpdateDocumentRequest struct {
	FileName *string `json:"file_name,omitempty"`
	Status   *string `json:"status,omitempty"`
}

// AuditReport represents the analysis results for a document
type AuditReport struct {
	ID                uint              `json:"id" gorm:"primaryKey;autoIncrement"`
	DocumentID        uint              `json:"document_id" gorm:"not null;index"`
	RoundNumber       int               `json:"round_number" gorm:"not null;default:1"`
	ResilienceScore     *int              `json:"resilience_score,omitempty" gorm:"type:int"`
	ResilienceRationale string            `json:"resilience_rationale,omitempty" gorm:"type:text"`
	SectionScores       datatypes.JSON    `json:"section_scores,omitempty" gorm:"type:jsonb;default:'[]'" swaggertype:"string"`
	QualityScore        *int              `json:"quality_score,omitempty" gorm:"type:int"`
	QualityIssues       datatypes.JSONMap `json:"quality_issues,omitempty" gorm:"type:jsonb;default:'{}'" swaggertype:"string"`
	QualityReason       string            `json:"quality_reason,omitempty" gorm:"type:text"`
	HeatmapData         datatypes.JSONMap `json:"heatmap_data" gorm:"type:jsonb;default:'{}' " swaggertype:"string"`
	Vulnerabilities   datatypes.JSON    `json:"vulnerabilities" gorm:"type:jsonb;default:'[]' " swaggertype:"string"`
	LogicalFallacies  datatypes.JSON    `json:"logical_fallacies" gorm:"type:jsonb;default:'[]' " swaggertype:"string"`
	FortificationPlan datatypes.JSONMap `json:"fortification_plan" gorm:"type:jsonb;default:'{}' " swaggertype:"string"`
	CreatedAt         time.Time         `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt         time.Time         `json:"updated_at" gorm:"autoUpdateTime"`
}

// TableName specifies the table name for AuditReport model
func (AuditReport) TableName() string {
	return "audit_reports"
}

// AudioDebate represents the audio debate generated for a document
type AudioDebate struct {
	ID                 uint           `json:"id" gorm:"primaryKey;autoIncrement"`
	DocumentID         uint           `json:"document_id" gorm:"not null;index"`
	RoundNumber        int            `json:"round_number" gorm:"not null;default:1"`
	CloudinaryAudioURL string         `json:"cloudinary_audio_url" gorm:"type:varchar(500)"`
	TranscriptJSON     datatypes.JSON `json:"transcript_json" gorm:"type:jsonb;default:'[]' " swaggertype:"string"`
	CreatedAt          time.Time      `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt          time.Time      `json:"updated_at" gorm:"autoUpdateTime"`
}

// TableName specifies the table name for AudioDebate model
func (AudioDebate) TableName() string {
	return "audio_debates"
}
