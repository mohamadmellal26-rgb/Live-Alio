package main

import (
    "log"
    "os"
    "time"

    "gorm.io/driver/postgres"
    "gorm.io/gorm"
)

// Content Model - تم إضافته ليعرف المترجم الهيكل عند التنفيذ في AutoMigrate
type Content struct {
    ID          uint      `gorm:"primaryKey;autoIncrement" json:"id"`
    Title       string    `json:"title"`
    Description string    `json:"description"`
    URL         string    `json:"url"`
    Type        string    `json:"type"` // e.g. "video", "pdf"
    UserID      uint      `json:"userId"`
    User        User      `gorm:"foreignKey:UserID" json:"user,omitempty"`
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

    // AutoMigrate للجداول
    err = DB.AutoMigrate(&User{}, &Content{})
    if err != nil {
        log.Fatalf("Failed to auto-migrate database schema: %v", err)
    }

    log.Println("Database connection established & schema migrated successfully.")
    return DB
}