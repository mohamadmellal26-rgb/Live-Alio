package main

import (
    "log"
    "os"

    "gorm.io/driver/postgres"
    "gorm.io/gorm"
)

var DB *gorm.DB // تأكد أن هذا المتغير غير معرف في ملف auth.go بنفس الحزمة، أو قم بإزالته من هناك

func InitDB() *gorm.DB {
    dsn := os.Getenv("DATABASE_URL")
    if dsn == "" {
        dsn = "host=localhost user=postgres password=yourpassword dbname=live_aleo_db port=5432 sslmode=disable"
    }

    var err error
    DB, err = gorm.Open(postgres.Open(dsn), &gorm.Config{})
    if err != nil {
        log.Fatalf("Failed to connect to PostgreSQL database: %v", err)
    }

    err = DB.AutoMigrate(&User{})
    if err != nil {
        log.Fatalf("Failed to auto-migrate database schema: %v", err)
    }

    log.Println("Database connection established & schema migrated successfully.")
    return DB
}