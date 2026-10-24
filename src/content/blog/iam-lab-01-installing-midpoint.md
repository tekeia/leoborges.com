---
title: "IAM Lab #1: Installing midPoint with Docker on Ubuntu Server"
date: 2026-10-16
description: "Installing Docker on an Ubuntu Server VM in Proxmox, then starting midPoint with Evolveum's quickstart script."
series: "IAM Lab"
part: 1
project: midpoint-identity-lab
tags: ["IAM", "midPoint", "Docker"]
---

With Ubuntu Server running as a VM on Proxmox, the next step is getting midPoint up. midPoint is an open source identity governance platform, and the quickest way to run it is with Docker, which is a prerequisite for Evolveum's quickstart script.

Official reference: [midPoint Quick Start](https://docs.evolveum.com/midpoint/get-started/quick-start/)

## Step 1: Install Docker

```bash
curl -fsSL https://get.docker.com | sudo sh
```

This downloads Docker's official install script and runs it as root. It takes a minute or two and asks for your password.

What the flags mean:

- `-f` fails with an error instead of silently saving an error page
- `-s` hides the progress bar
- `-S` still shows errors when `-s` is on
- `-L` follows redirects

The `| sudo sh` part pipes the downloaded script straight into a shell running as root. It's convenient, but it runs code you haven't read with full privileges. A more careful approach is to save it, read it, then run it:

```bash
curl -fsSL https://get.docker.com -o get-docker.sh
less get-docker.sh
sudo sh get-docker.sh
```

## Step 2: Let your user run Docker without sudo

```bash
sudo usermod -aG docker $USER
newgrp docker
```

`usermod` adds your user (mine is `midpoint`) to the `docker` group, and `newgrp` applies the change right away in the current terminal. In new terminals, or after a reboot, it applies automatically.

## Step 3: Check that Docker works

```bash
docker --version
docker compose version
docker run hello-world
```

The last command should print a "Hello from Docker!" message. If it does, Docker is ready.

## Step 4: Download the midPoint quickstart script

Create a folder for midPoint and move into it:

```bash
mkdir midpoint
cd midpoint
```

Download the quickstart script with `curl`:

```bash
curl -fL -O https://raw.githubusercontent.com/Evolveum/midpoint-docker/master/midpoint-quickstart.sh
```

`-O` saves the file using the name at the end of the URL. Confirm it actually downloaded:

```bash
ls -l
```

The file should be around 24 KB, not 0.

## Step 5: Make the script executable

```bash
chmod 744 midpoint-quickstart.sh
```

`744` gives the owner read, write and execute permissions, and everyone else read-only. `chmod +x midpoint-quickstart.sh` works too.

## Step 6: Start midPoint

```bash
./midpoint-quickstart.sh start
```

The script uses Docker Compose to start three containers: a PostgreSQL database, a one-time setup container that prepares the database, and the midPoint server. The first run downloads the images, so give it a few minutes.

When it finishes, your terminal should look something like this:

![midPoint quickstart script output after starting](/images/iam-lab/midpoint-installation-success.jpg)

The output shows the address to open in your browser and the login details for the administrator account.

## What's next

Next post: first login, and connecting midPoint to an HR source using a CSV file.
