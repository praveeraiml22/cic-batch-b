# CIC-Batch-B

# Build a Full-Stack Professional Website for Civil Innovation Club (CIC), MNNIT Allahabad

## Project Overview

Build a modern, production-ready, full-stack web application for the Civil Innovation Club (CIC) of Motilal Nehru National Institute of Technology (MNNIT), Allahabad.

The website should have a premium, clean, professional, responsive, and modern UI similar to top university and corporate portals.

The platform must include:

1. Public Landing Website

2. Student Authentication System

3. Student Dashboard

4. Admin Dashboard

5. Complete Document Management System (DMS)

6. Assignment Submission System

7. Feedback & Review System

8. User Management

9. Notifications

10. Secure File Storage

11. Database Integration

12. Deployment-Ready Architecture

---

# Technology Stack

Use the following stack:

Frontend:

* Next.js 14+

* React

* TypeScript

* Tailwind CSS

* ShadCN UI

* Framer Motion

* Lucide Icons

Backend:

* Next.js API Routes OR Express.js

* Node.js

* TypeScript

Database:

* PostgreSQL

ORM:

* Prisma

Authentication:

* NextAuth.js

* JWT Sessions

Storage:

* Cloudinary OR AWS S3

Deployment:

* Netlify (Frontend)

* Railway/Supabase/Render (Backend + Database)

Version Control:

* GitHub

---

# Branding

Organization Name:

Civil Innovation Club (CIC)

Institute:

Motilal Nehru National Institute of Technology (MNNIT), Allahabad

Primary Colors:

* Dark Navy Blue (#0F172A)

* White (#FFFFFF)

* Gold Accent (#D4AF37)

Typography:

* Modern professional font

* Clean academic appearance

Logo:

Use uploaded CIC logo prominently throughout the website.

---

# Landing Page

Create an elegant landing page.

Sections:

## Hero Section

Display:

* CIC Logo

* Welcome Message

* Animated background

* Institute name

* Tagline:

"Innovating Infrastructure, Building the Future"

Buttons:

* Login

* Learn More

---

## About CIC

Include:

* Mission

* Vision

* Club Objectives

* Innovation Activities

* Editable Faculty and students coordinator section with photo,name  and designation that can be edited by admins.

Professional card-based layout.

---

## Club Highlights

Animated statistics cards:

* Members

* Projects

* Workshops

* Events Conducted

---

## Recent Activities

Dynamic section connected to database.

Admin can add:

* Events

* Workshops

* Announcements

* Broadcast notification 

---

## Editable Faculty Coordinators

Display:

* Name

* Position

* Photo

---

##Editable Student Coordinators

Display:

* Name

* Designation

* Photo

---

## Contact Section

Include:

* Contact Form

* Email

* Institute Address

* Social Media Links

---

# Authentication System

Create a secure login system.

User Types:

1. Student

2. Admin

Login Fields:

* Student ID

* Password

Features:

* Password hashing

* JWT authentication

* Session management

* Forgot Password

* Change Password

Role-based access control.

---

# Student Dashboard

After login students enter dashboard.

Dashboard includes:

## Sidebar Navigation

* Dashboard

* My Assignments

* Submit Assignment

* Documents

* Feedback

* Notifications

* Profile

* Logout

---

## Dashboard Overview

Cards:

* Total Assignments

* Submitted Assignments

* Pending Assignments

* Feedback Received

---

# Assignment Management System

Students should be able to:

Create Submission

Fields:

* Assignment Title

* Subject

* Description

* Semester

* Upload File

Supported File Types:

* PDF

* DOC

* DOCX

* PPT

* PPTX

* XLS

* XLSX

* ZIP

* RAR

* Images

* Any Other Extension

Maximum Size:

100 MB

Store file securely.

---

# Document Management System

Build a complete enterprise-style DMS.

Students can:

* Upload documents

* Download documents

* View metadata

* Search files

* Filter files

* Organize files

Categories:

* Assignments

* Reports

* Research Papers

* Project Files

* Notes

* Miscellaneous

Features:

* Folder structure

* Version history

* File preview

* File tagging

* Advanced search

---

# Admin Dashboard

Professional admin portal.

Admin can:

* Manage Students

* Manage Documents

* Manage Assignments

* Manage Feedback

* Manage Events

* Manage Announcements

* Manage Broadcast 

* Manage faculty and student coordinator details

---

## Admin Analytics

Show charts:

* Active Users

* Assignment Submissions

* Storage Usage

* Monthly Uploads

Use:

* Recharts

---

# Assignment Review Workflow

Student uploads assignment.

Admin can:

* View submission

* Download file

* Add comments

* Add grades

* Provide feedback

* Request resubmission

Status Types:

* Submitted

* Under Review

* Approved

* Rejected

* Resubmission Required

Student sees status updates in real time.

---

# Feedback System

Admin Feedback Form:

Fields:

* Assignment

* Feedback Notes

* Grade

* Recommendations

Students can:

* View feedback

* Download reviewed files

* See grading history

---

# Notification System

Real-time notifications.

Events:

* Assignment Uploaded

* Feedback Received

* Assignment Approved

* New Announcement

Use:

* WebSockets OR Pusher

Notification Bell in dashboard.

---

# Profile System

Student Profile:

* Name

* Student ID

* Department

* Semester

* Email

* Mobile Number

* Profile Picture

Editable Profile.

---

# Search System

Global search functionality.

Search:

* Assignments

* Documents

* Students

* Announcements

Include:

* Filters

* Sorting

* Pagination

---

# Security Requirements

Implement:

* Role-based access control

* File validation

* Input sanitization

* SQL injection protection

* CSRF protection

* Rate limiting

* Secure password hashing (bcrypt)

* Audit logs

Only authenticated users can access protected resources.

---

# Database Schema

Users Table

* id

* name

* studentId

* email

* password

* role

* department

* semester

* profileImage

* createdAt

Assignments Table

* id

* title

* description

* status

* submittedBy

* fileUrl

* feedback

* grade

* createdAt

Documents Table

* id

* title

* category

* fileUrl

* version

* uploadedBy

* createdAt

Notifications Table

* id

* userId

* title

* message

* read

* createdAt

Events Table

* id

* title

* description

* image

* date

Announcements Table

* id

* title

* description

* createdAt

---

# UI/UX Requirements

Design must be:

* Modern

* Responsive

* Mobile-first

* Professional

* Premium-looking

* Fast loading

Include:

* Dark Mode

* Light Mode

* Smooth Animations

* Loading Skeletons

* Toast Notifications

* Confirmation Dialogs

---

# Additional Features

* Activity Logs

* File Version Tracking

* Admin Audit Panel

* Dashboard Analytics

* Bulk File Upload

* Bulk Student Import via CSV

* Export Reports to PDF

* Email Notifications

---

# Deliverables

Generate:

1. Complete Frontend

2. Complete Backend

3. Database Models

4. Prisma Schema

5. API Endpoints

6. Authentication System

7. Admin Panel

8. Student Panel

9. Document Management System

10. Assignment Workflow

11. Deployment Configuration

12. Environment Variables

13. README Documentation

14. Seed Data

15. Production-Ready Code

The final product should be fully functional, scalable, secure, and deployable without placeholder pages. Every button, form, dashboard section, API route, database operation, upload workflow, feedback system, notification system, and admin action must be implemented end-to-end.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://cic-batch-b.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/d8c49199-230d-446a-97bb-3344b5f1b61b).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
