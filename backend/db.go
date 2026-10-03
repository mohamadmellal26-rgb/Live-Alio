package main

import (
	"log"
	"os"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

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

	// تأكد من إضافة جميع الـ Structs المرتطبة بالداتا بيز هنا
	err = DB.AutoMigrate(&User{}, &Content{}) 
	if err != nil {
		log.Fatalf("Failed to auto-migrate database schema: %v", err)
	}

	log.Println("Database connection established & schema migrated successfully.")
	return DB
}