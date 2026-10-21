---
title: "IAM Lab #7: Adding an HR system as the source of truth"
date: 2026-10-18
description: "Why real identity programs start from HR, and deploying OrangeHRM with Docker on its own VM as the lab's authoritative source."
---

So far, Active Directory has been the source of truth in my lab: midPoint reads users from AD and creates identities from them. That was a good way to learn import, correlation and reconciliation, but it's not how real companies work. In this post I add an HR system to the lab and explain why it changes the design.

## Why HR, not AD

In most organizations, identity data flows in one direction:

**HR system → IGA tool → target systems**

- The **HR system** (Workday, SAP SuccessFactors, ADP and others) knows who works at the company, in which department, and whether they're still employed.
- The **IGA tool** (midPoint here, SailPoint in many enterprises) reads HR and decides what accounts and access each person should have.
- **AD and the other applications are targets**: accounts are created, changed and disabled there automatically.

This is what drives the joiner/mover/leaver lifecycle:

- **Joiner:** a new hire in HR gets their accounts created.
- **Mover:** a department change in HR updates their access.
- **Leaver:** a termination in HR disables their accounts.

With AD as the source, a leaver would have to be handled by someone disabling the account in AD first, which is backwards. HR should drive it.

## Choosing an HR system

I considered three options:

| Option | Effort | Realism |
| --- | --- | --- |
| CSV file | Low | Common in practice: many companies send a nightly HR export file |
| Database table | Medium | Close to integrating with an application's database |
| Open source HRIS | Higher | A real HR application with its own data model |

I chose **OrangeHRM**, an open source HR system, and plan to integrate it through its **database**. It's the same kind of work as a JDBC connector to a legacy application, which is common in enterprise IAM. If the integration turned out to take too long, the fallback was a CSV export of the same data, with the IAM logic unchanged.

OrangeHRM comes in two editions: **Starter**, which is free and open source (GPL-3.0), and **Advanced**, a paid cloud product. The self-hosted Starter edition has everything the lab needs: employee records, departments and terminations. The paid edition adds external REST API access, which makes a database integration the natural choice for the free version.

## A separate VM

I put OrangeHRM on its own VM in Proxmox, `hr01`, instead of next to midPoint:

- It mirrors reality: the HR system and the IGA tool never share a server.
- midPoint has to reach HR over the network, like a real integration.
- Either system can be restarted or rebuilt without affecting the other.

| Setting | Value |
| --- | --- |
| OS | Ubuntu Server |
| CPU | 2 cores |
| Memory | 2 GB |
| Disk | 20 GB |

After installing Ubuntu with OpenSSH, I installed Docker the same way as on the midPoint VM. Each command runs separately:

```bash
curl -fsSL https://get.docker.com | sudo sh
```
```bash
sudo usermod -aG docker $USER
```
```bash
newgrp docker
```

## Docker in a nutshell

If you're used to VMs, Docker containers are the lightweight version: instead of a whole operating system, a container packages one application and shares the host's kernel.

| Concept | What it is |
| --- | --- |
| Image | A read-only template of an application, downloaded from a registry like Docker Hub |
| Container | A running instance of an image |
| Volume | Storage that survives when a container is removed |
| Port mapping | Sends traffic from a port on the VM to a port inside the container |
| Docker Compose | A file describing several containers that run together |

Containers are disposable, so anything that matters, like the database files, must live in a volume.

## Deploying OrangeHRM with Docker Compose

OrangeHRM needs two containers: the web application and a MariaDB database. One `docker-compose.yml` describes both:

```yaml
services:
  orangehrm-db:
    image: mariadb:10.11
    restart: unless-stopped
    environment:
      MARIADB_ROOT_PASSWORD: ${DB_ROOT_PASSWORD}
      MARIADB_DATABASE: orangehrm
      MARIADB_USER: orangehrm
      MARIADB_PASSWORD: ${DB_PASSWORD}
    ports:
      - "3306:3306"          # published so midPoint can reach the database (JDBC)
    volumes:
      - orangehrm_db:/var/lib/mysql

  orangehrm:
    image: orangehrm/orangehrm:latest
    restart: unless-stopped
    depends_on:
      - orangehrm-db
    ports:
      - "8081:80"
    volumes:
      - orangehrm_data:/var/www/html

volumes:
  orangehrm_db:
  orangehrm_data:
```

The passwords aren't in the compose file. They come from a separate `.env` file on the VM:

```
DB_ROOT_PASSWORD=...
DB_PASSWORD=...
```

That way, the compose file can live in a Git repository while the secrets stay on the server. I keep a `.env.example` template with placeholder values in the repo, and create the real `.env` from it on the VM:

```bash
cp .env.example .env
nano .env
```

MariaDB only reads these passwords on its very first start, when it creates the database, so they need to be set before running `docker compose up -d` for the first time.

Then, from the folder with both files:

```bash
docker compose up -d
docker compose ps
```

Docker downloads both images from Docker Hub, creates the network and volumes, and starts the containers. `-d` runs them in the background, and `restart: unless-stopped` brings them back after a reboot.

A note on images: `mariadb` is a Docker Official Image and `orangehrm/orangehrm` comes from OrangeHRM's own organization on Docker Hub. Sticking to official publishers and pinning versions (like `mariadb:10.11` instead of `latest`) are simple habits that reduce supply-chain risk.

## Running the installer

OrangeHRM's web installer runs at `http://<HR-VM-IP>:8081`. On the database step:

| Field | Value |
| --- | --- |
| Option | Existing Empty Database |
| Database host | `orangehrm-db` |
| Port | `3306` |
| Database name | `orangehrm` |
| Username | `orangehrm` |

**Existing Empty Database** is the right choice because MariaDB already created the empty `orangehrm` database on its first start. The host is the database container's name: containers in the same Compose file reach each other by name through Docker's internal DNS.

## The admin account

The installer creates an admin login, and OrangeHRM attaches every login to an employee record. I named mine "OrangeHRM Admin" rather than using my own name, because it works like a root or break-glass account: it belongs to the system, not to a person.

The usual practices for accounts like this:

- Keep the password in a vault, with an owner responsible for it.
- Don't use it day to day; admins use named accounts so audit logs point to real people.
- Monitor every use.

Since "OrangeHRM Admin" also appears as an employee, it would look like a real person to midPoint. Instead of deleting it (it's the admin login), I'll filter it out in the database view midPoint reads. Filtering system and test records out of HR feeds is common in real integrations.

## The HR data

In OrangeHRM, employee records live in **PIM** (Personnel Information Management), and departments are called **sub-units** (under **Admin → Organization → Structure**). I created four departments, Finance, IT, HR and Sales, and these employees:

| Name | Department |
| --- | --- |
| Ana Souza | Finance |
| Bruno Lima | IT |
| Carla Mendes | HR |
| Diego Alves | Sales |
| Eduardo Costa | IT |

Each one gets an **Employee Id** from OrangeHRM, which will be the correlation key in midPoint. Unlike a username, an employee ID never changes.

The first four already have AD accounts and midPoint users, so they'll test correlation: midPoint should match them to the existing users instead of creating duplicates. Eduardo exists only in HR, so he'll be the lab's first real joiner.

## What's next

Next post: building a database view over OrangeHRM's tables, creating a read-only account for midPoint, and connecting midPoint to the HR database with the DatabaseTable connector.
