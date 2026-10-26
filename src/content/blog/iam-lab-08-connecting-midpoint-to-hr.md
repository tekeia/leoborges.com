---
title: "IAM Lab #8: Connecting midPoint to the HR database"
date: 2026-10-26
description: "A database view as a clean HR feed, a read-only account for midPoint, adding the MariaDB JDBC driver, and creating the HR resource with the DatabaseTableConnector."
series: "IAM Lab"
part: 8
project: midpoint-identity-lab
tags: ["IAM", "midPoint", "OrangeHRM", "JDBC"]
---

In the last post I deployed OrangeHRM as the lab's HR system. Now midPoint needs to read it. In this post I build a clean HR feed inside the database, give midPoint a read-only account, add the JDBC driver midPoint needs, and create the HR resource.

## The design

A few rules I followed, because they're how real HR integrations are built:

- **midPoint reads a view, not OrangeHRM's tables.** OrangeHRM's schema is normalized: the department and the termination live in separate tables. A view joins them into one clean row per employee, and shields midPoint from schema changes when OrangeHRM is upgraded.
- **midPoint gets a read-only account** that can only read that view. The IGA tool never writes to the HR database.
- **The key is the employee ID**, never a name. Names change; employee IDs don't.
- **The view exposes a status column** (active or terminated), so midPoint can drive the leaver flow later.

## Who owns the username and email?

My first version of the view included OrangeHRM's work email. I took it out. HR shouldn't type usernames and email addresses by hand: generating them is the IGA tool's job. midPoint will create them from the person's name, with a rule for duplicates (`ECosta`, then `ECosta1`).

It's the same thing SailPoint engineers configure: a unique account ID generator in Identity Security Cloud, or a provisioning policy with a field value rule in IdentityIQ. So the HR feed carries only what HR actually owns: ID, name, department and status.

## Step 1: The view

On `hr01`, I opened the MariaDB console inside the database container:

```bash
cd ~/orangehrm
docker compose exec orangehrm-db mariadb -u root -p orangehrm
```

`docker compose exec` runs a command inside a running container, here the `mariadb` client in the database container.

Before creating anything, I checked the table and column names with `DESCRIBE hs_hr_employee;`, since they can differ between OrangeHRM versions. Then the view:

```sql
CREATE OR REPLACE VIEW midpoint_employees AS
SELECT
  e.employee_id     AS emp_id,
  e.emp_firstname   AS first_name,
  e.emp_lastname    AS last_name,
  s.name            AS department,
  CASE WHEN e.termination_id IS NULL THEN 'active' ELSE 'terminated' END AS status
FROM hs_hr_employee e
LEFT JOIN ohrm_subunit s ON e.work_station = s.id
WHERE e.employee_id <> '0001'
  AND e.purged_at IS NULL;
```

What each part does:

- **`AS`** renames OrangeHRM's internal column names (`emp_firstname`) to simple ones (`first_name`), so midPoint sees a clean schema.
- **The `CASE`** creates a column that doesn't exist in OrangeHRM. An employee with no termination record is `active`; otherwise `terminated`.
- **The `LEFT JOIN`** pulls the department name from OrangeHRM's sub-unit table. A `LEFT` join keeps an employee even if they have no department yet.
- **The `WHERE`** filters out the `OrangeHRM Admin` system record (employee ID `0001`), which would otherwise look like a real person to midPoint, and any purged records.

`CREATE OR REPLACE` means I can rerun it after changes, which is exactly what I did when I removed the email column.

## Step 2: A read-only account

```sql
CREATE USER 'midpoint_ro'@'%' IDENTIFIED BY 'a-strong-password';
GRANT SELECT ON orangehrm.midpoint_employees TO 'midpoint_ro'@'%';
```

The account can run `SELECT` on the view and nothing else: no other tables, no writes. `ro` stands for read-only, a common naming convention so anyone looking at the database knows the account's purpose without checking its permissions.

A quick check:

```sql
SELECT * FROM midpoint_employees;
SHOW GRANTS FOR 'midpoint_ro'@'%';
```

Five rows came back: Ana, Bruno, Carla, Diego and Eduardo, each with a department and status `active`.

## Step 3: Test from the midPoint VM

Before touching midPoint, I tested the connection from the machine midPoint runs on. On the midPoint VM:

```bash
sudo apt install mariadb-client -y
mariadb -h <hr01-ip> -u midpoint_ro -p orangehrm -e "SELECT * FROM midpoint_employees;"
```

The same five rows. That one command proves three things at once: the network path between the VMs, the account's password, and its permission on the view. If the connector fails later, I know it's a midPoint setting, not the network or the database.

## Step 4: The JDBC driver

midPoint is written in Java, and Java talks to databases through **JDBC**. midPoint's DatabaseTableConnector only speaks that standard; a **JDBC driver** translates it into a specific database's protocol. midPoint ships with a driver for PostgreSQL (its own database), but not for MariaDB, so I added one.

The driver is just a `.jar` file. midPoint loads extra jars from the `lib` folder in its home directory, which the quickstart mounts into the container:

```bash
mkdir -p ~/midpoint/midpoint-home/lib
curl -fL -o ~/midpoint/midpoint-home/lib/mariadb-java-client-3.5.10.jar \
  https://repo1.maven.org/maven2/org/mariadb/jdbc/mariadb-java-client/3.5.10/mariadb-java-client-3.5.10.jar
ls -l ~/midpoint/midpoint-home/lib
```

The jar came in at about 790 KB. Java loads libraries at startup, so midPoint needs a restart to see it:

```bash
cd ~/midpoint
./midpoint-quickstart.sh stop
./midpoint-quickstart.sh start
```

This is the same step as with SailPoint's JDBC connectors at work: the database vendor's driver jar has to be added before the connector can reach the database.

## Step 5: The HR resource

In midPoint: **Resources → New resource → From scratch**, then **DatabaseTableConnector**. I named it `HR - OrangeHRM`.

| Field | Value |
| --- | --- |
| Host | the `hr01` IP |
| Port | `3306` |
| User | `midpoint_ro` |
| User password | **Use clear value**, then the password |
| Database | `orangehrm` |
| Table | `midpoint_employees` |
| Key column | `emp_id` |
| JDBC driver | `org.mariadb.jdbc.Driver` |
| JDBC URL template | `jdbc:mariadb://%h:%p/%d` |

The less obvious ones:

- **Key column** is the value that uniquely identifies each record on this system. It's different on every resource: `emp_id` here, `objectGUID` in AD.
- **JDBC URL template:** the connector fills in `%h` (host), `%p` (port) and `%d` (database).
- **Use clear value** means typing the actual password, as opposed to referencing a **secrets provider** (environment variables, a vault). midPoint still encrypts it before saving. Moving it to a secrets provider is a good exercise for later, the same idea as Delinea Secret Server.
- The driver class is `org.mariadb.jdbc.Driver`. Evolveum's docs show an older MySQL class name, which doesn't work with this driver.

## What went wrong

The first connection test failed, even though the password was right. The cause: I had put `midpoint_employees` in the **Database** field instead of `orangehrm`. The **Table** and **Key column** fields were hidden under **Show empty fields**, so I never filled them in. Once I fixed those, the connection worked.

The **+** shortcut for new resources also crashed in my midPoint version; the **Resources** menu worked.

### The password I forgot

Halfway through the wizard I realized I didn't remember the `midpoint_ro` password. There's no way to read a MariaDB password back, but root can set a new one, so the real question was getting in as root. And I didn't have the database root password saved anywhere.

What I did have were the server's login credentials, saved in 1Password, the password manager I use personally. That was enough. I SSH'd into `hr01`, went into the OrangeHRM folder and read the `.env` file:

```bash
cd ~/orangehrm
cat .env
```

A `.env` file holds environment variables: settings an application reads when it starts, kept outside its code and configuration. Docker Compose reads the `.env` in the same folder automatically and fills in the `${...}` placeholders in `docker-compose.yml`. That's how the database root password reaches the MariaDB container without being written into the compose file, so the compose file is safe to share or put in Git. The `.env` itself never goes into Git.

That's where `DB_ROOT_PASSWORD` was. With root access, one statement reset the account:

```sql
ALTER USER 'midpoint_ro'@'%' IDENTIFIED BY 'a-new-strong-password';
```

`ALTER USER` only changes the password; the account's permission on the view stays the same. I tested the new password from the midPoint VM with the same `mariadb` command as before, then saved it in 1Password right away.

It also made me look at that `.env` file differently: the database root password sits there in plain text for anyone with a shell on `hr01`. That's acceptable in a home lab, but in production that secret would live in a vault and be injected at runtime, the same reason midPoint offers secrets providers.

## Schema and object type

The DatabaseTableConnector exposes the view as a single object class, `AccountObjectClass`. That's why there was nothing to choose in the schema step: the resource has only one kind of record. Each row is an object and each column an attribute, with `emp_id` as the identifier.

Then I defined the object type, like I did for AD:

| Field | Value |
| --- | --- |
| Display name | `HR Employee` |
| Kind | `Account` |
| Intent | `default` |
| Object class | `AccountObjectClass` |
| Type (midPoint data) | `User` |

It looks odd that an HR record is an "account", but in midPoint every record on a resource is an account of that resource. What makes HR the *source* isn't the kind; it's the direction of the mappings. SailPoint works the same way: every identity has an "account" on the authoritative HR source.

**Resource objects** listed all five employees. midPoint can read HR.

## What's next

midPoint can see HR, but doesn't do anything with it yet. Next post: inbound mappings, including generated usernames, and two-tier correlation, so the four people who already exist in midPoint (created from AD) get linked to their HR records instead of duplicated.
