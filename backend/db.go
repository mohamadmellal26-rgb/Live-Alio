package main

import (
	"log"
	"os"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

func InitDB() *gorm.DB {
	// جلب رابط الاتصال من متغيرات البيئة
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		// السلوك الافتراضي للـ Local Development فقط
		dsn = "host=localhost user=postgres password=yourpassword dbname=live_aleo_db port=5432 sslmode=disable"
	}

	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		log.Fatalf("Failed to connect to PostgreSQL database: %v", err)
	}

	return db
}