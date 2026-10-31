CREATE TABLE users (
    id VARCHAR(255),
    email VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    password_hash TEXT NOT NULL,
    role VARCHAR(50) NOT NULL,
    avatar_url TEXT,
    disabled BOOLEAN DEFAULT FALSE,
    created_by VARCHAR(255),
    created_at TEXT,
    updated_by VARCHAR(255),
    updated_at TEXT,
    PRIMARY KEY (id),
    CONSTRAINT uni_users_email UNIQUE (email),
    CONSTRAINT uni_users_name UNIQUE (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
