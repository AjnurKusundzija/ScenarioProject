# ScenarijPro – Web Technologies Project

## Overview
ScenarijPro is a web application developed as part of the Web Technologies course at the Faculty of Electrical Engineering, University of Sarajevo.  
The project represents a collaborative screenplay editor developed incrementally through multiple project phases (spirals), starting from a static user interface and evolving into a full backend system with database support and version control.

The application allows users to create, edit, and manage screenplay scenarios while supporting collaborative editing and mechanisms for preventing conflicts between users.

---

## Features

### Frontend (Spirala 1 & 2)
- Responsive user interface for managing screenplay projects
- Script writing editor
- Scene organization and navigation
- Text formatting (bold, italic, underline)
- Detection and analysis of screenplay roles and dialogue segments
- Word statistics and editor utilities

### Backend API (Spirala 3)
- REST API implemented using Node.js and Express
- Scenario creation and retrieval
- Line locking mechanism to prevent simultaneous editing conflicts
- Character renaming across the entire scenario
- Automatic line wrapping for long text
- Change tracking using timestamped deltas
- Persistent storage using JSON files

### Database and Versioning (Spirala 4)
- Migration from file-based storage to MySQL database
- Sequelize ORM integration
- Scenario versioning system based on:
  - Deltas (history of changes)
  - Checkpoints (saved scenario states)
- Ability to restore a scenario to any previously saved checkpoint

---

## Technologies Used
- HTML5
- CSS3
- JavaScript (ES6)
- Node.js
- Express.js
- MySQL
- Sequelize ORM
- REST API architecture

---

## Setup

Install dependencies:

npm install

Configure MySQL database:

Database name: wt26  
User: root  
Password: password

Start the server:

npm start

---

## API Capabilities
- Create and manage scenarios
- Lock and update individual lines collaboratively
- Rename characters globally
- Track scenario changes through deltas
- Create checkpoints and restore previous versions

---

## Academic Context
This project was developed during the 2025/26 academic year as part of the Web Technologies course.  
The implementation demonstrates progressive development of frontend design, backend services, concurrency control mechanisms, and relational database integration.

---

## Author
Student project – Web Technologies course  
