package main

import (
    "log"
    "os"
    "time"

    "gorm.io/driver/postgres"
    "gorm.io/gorm"
)

// Content Model - تم تعديل الحقول لتتطابق مع نوع string (UUID) الخاص بجدول User
type Content struct {
    ID          string    `gorm:"primaryKey;type:varchar(36)" json:"id"`
    Title       string    `json:"title"`
    Description string    `json:"description"`
    URL         string    `json:"url"`
    Type        string    `json:"type"` // e.g. "video", "pdf"
    UserID      string    `gorm:"type:varchar(36)" json:"userId"`
    User        User      `gorm:"foreignKey:UserID;references:ID" json:"user,omitempty"`
    CreatedAt   time.Time `json:"createdAt"`
    UpdatedAt   time.Time `json:"updatedAt"`
}

var DB *gorm.DB

func InitDB() *gorm.DB {
    dsn := os.Getenv("DATABASE_URL")
    if dsn == "" {
        dsn = "host=localhost user=postgres password=yourpassword dbname=live_aleo_db port=5432 sslmode=disable"
    }

    var err error
    DB, err = gorm.Open(postgres.Open(dsn), &gorm.Config{
        PrepareStmt: false,
    })
    if err != nil {
        log.Fatalf("Failed to connect to PostgreSQL database: %v", err)
    }

    // AutoMigrate للجداول بعد توحيد أنواع الحقول
    err = DB.AutoMigrate(&User{}, &Content{})
    if err != nil {
        log.Fatalf("Failed to auto-migrate database schema: %v", err)
    }

    log.Println("Database connection established & schema migrated successfully.")
    return DB
}