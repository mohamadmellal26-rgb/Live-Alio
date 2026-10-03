package main

import (
	"log"
	"os"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

// تعريف المتغير العام DB ليكون متاحاً لجميع الملفات في package main مثل auth.go
var DB *gorm.DB

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

    // 🔴 إضافة الهجرة التلقائية لإنشاء جدول User فور تشغيل التطبيق
    err = DB.AutoMigrate(&User{})
    if err != nil {
        log.Fatalf("Failed to auto-migrate database schema: %v", err)
    }

    log.Println("Database connection established & schema migrated successfully.")
    return DB
}