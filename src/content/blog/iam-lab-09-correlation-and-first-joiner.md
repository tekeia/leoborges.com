---
title: "IAM Lab #9: Correlation and the first joiner"
date: 2026-10-27
description: "Inbound mappings with a generated username, two-tier correlation to link existing users without duplicating them, and the lab's first HR-driven joiner."
series: "IAM Lab"
part: 9
project: midpoint-identity-lab
tags: ["IAM", "midPoint", "OrangeHRM", "Correlation"]
---

In the last post I connected midPoint to the HR database: it can read the `midpoint_employees` view and lists all five employees as accounts. But it doesn't do anything with them yet. In this post I configure the rules that turn HR records into identities, and run the import.

The goal is specific. Four of the five employees already exist as midPoint users, created earlier from Active Directory. The import has to **link** those four to their HR records without creating duplicates, and **create** the one person who only exists in HR. That new user is the lab's first real **joiner**.

All of this is on the HR resource, under **Schema handling → Object types → HR Employee**.

## Inbound mappings

Mappings decide which HR column fills which midPoint field. **Inbound** means data flows from HR into the midPoint user.

| HR attribute | Target | Strength |
| --- | --- | --- |
| `uid` (the key column) | `personalNumber` | Strong |
| `first_name` | `givenName` | Strong |
| `last_name` | `familyName` | Strong |
| `department` | `organizationalUnit` | Strong + Exclusive |
| `first_name` (script) | `fullName` | Strong |
| `first_name` (script) | `name` (username) | **Weak** |

![midPoint inbound mappings for the HR Employee object type, six rows mapping uid, first_name, last_name and department into midPoint fields](https://leoborges-blog-images.s3.us-east-1.amazonaws.com/iam-lab/iam-lab-08/hr-inbound-mappings.png)

The DatabaseTable connector exposes the view's key column (`emp_id`) as the account identifier `uid`, so the mapping for the employee ID reads from `uid`, not from a column called `emp_id`. Everything else maps straight from its view column.

Two ideas here matter more than the table.

**Strength** controls when a mapping is allowed to write:

- **Strong** always writes, overwriting whatever is there. HR is authoritative for names, department and employee ID, so if someone hand-edits those in midPoint, the next run puts HR's value back.
- **Weak** only writes when the target is empty.

**Why the username is Weak.** The four existing users already have usernames from AD (`ASouza`, `BLima`...). A weak mapping leaves those alone and only generates a username when there isn't one, which is exactly the new hire. It also protects the username from changing later: if an employee's last name changes in HR, a strong mapping would rename them everywhere and break logins, home folders and audit trails. A username should be generated once and then stay put.

The username comes from a small Groovy script: first initial + last initial + rest of the last name, so Eduardo Costa becomes `ECosta`. Groovy is midPoint's scripting language, the same role BeanShell plays in SailPoint.

**Exclusive on department.** Because `organizationalUnit` can hold several values, I marked the department mapping **exclusive**, meaning HR is the only source allowed to set it. In an earlier post AD had owned this field; removing that AD mapping and making HR exclusive is what hands department ownership cleanly to HR.

## Correlation: matching without duplicating

This is the heart of the post. When midPoint reads an HR record, it has to decide: is this a person I already know, or someone new? That decision is **correlation**.

The trap is that the four existing users came from AD and have **no employee ID yet**. So a single rule on employee ID would match nobody, and midPoint would create four duplicates. I used two tiers instead:

| Tier | Match on |
| --- | --- |
| 1 | `personalNumber` (employee ID) |
| 2 | `givenName` + `familyName` |

midPoint tries tier 1 first. On the very first import it finds nothing there, falls back to tier 2, and matches the four by name. Once matched, the HR mapping fills in their employee ID, so every run after that matches cleanly on tier 1. Matching by name is fragile in the real world (two people can share a name), so it exists only to bootstrap the first link. Once everyone has an employee ID, the name rule can be retired.

## Synchronization reactions

Each account lands in a **situation**, and each situation gets a **reaction**:

| Situation | Meaning | Reaction |
| --- | --- | --- |
| Unmatched | No user matches this record | Add focus (create the user) |
| Unlinked | A user matches but isn't connected | Link |
| Linked | Already connected | Synchronize |

"Focus" is midPoint's word for the object an account belongs to, here the user.

## Simulating before committing

New resources start in **Proposed (simulation)**. In that state, an import with the **Development** configuration shows what *would* happen and writes nothing. This is a safety net worth using every time.

The simulation showed exactly the split I wanted: four accounts **Unlinked** (the existing users, matched by name) and one **Unmatched** (the new hire).

![midPoint accounts list showing four HR records as UNLINKED and one as UNMATCHED](https://leoborges-blog-images.s3.us-east-1.amazonaws.com/iam-lab/iam-lab-08/hr-accounts-before-import.png)

Drilling into one of the matched records confirmed it would be a **modify**, not a create: the existing user gains the employee ID and a link to the HR account, while the username stays untouched.

![Simulation detail for an existing user showing a modify that adds the personal number and links the HR account](https://leoborges-blog-images.s3.us-east-1.amazonaws.com/iam-lab/iam-lab-08/hr-import-simulation-bruno.png)

The simulation earned its keep here: an early version of my mappings had the scripts attached to the wrong fields, which would have renamed every existing user to their first name. Because it ran as a simulation against the Proposed resource, nothing was damaged, and I fixed the mappings before any real write.

## Going live

With the simulation clean, I switched the resource's lifecycle state to **Active (production)** and ran the import again as a **Full** execution. The result, in **Users → All users**:

![midPoint All users list showing the four existing users now with personal numbers and two accounts each, plus the new ECosta user](https://leoborges-blog-images.s3.us-east-1.amazonaws.com/iam-lab/iam-lab-08/all-users-after-import.png)

- The four existing users now carry their **employee ID** and show **two accounts** each (AD + HR). They were matched, not duplicated.
- **ECosta** (Eduardo Costa) is brand new, created entirely from HR, with **one account**.

Eduardo is the lab's first joiner driven by HR. He has no email yet, because email generation is midPoint's job and I set that up in a later post when AD becomes a target, along with duplicate-username handling (`ECosta1`, and so on).

The flow now matches how real identity programs work: **HR → midPoint → targets**. A person appears in HR, and midPoint turns them into an identity on its own.

## What's next

Next post: the leaver. Using the HR `status` field so that a termination in OrangeHRM automatically disables the user in midPoint, completing the joiner/mover/leaver cycle on the HR side.
