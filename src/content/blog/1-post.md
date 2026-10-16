---
title: "What I Learned in Algorithms Class"
date: 2026-03-11
description: "A quick summary of the most useful things."
---

Your post content starts here. Write in plain **Markdown**.

## A heading

Normal paragraph text. You can make things **bold** or *italic*.

- Bullet point one
- Bullet point two

## Code blocks

Use triple backticks for code:

```python
def binary_search(arr, target):
    left, right = 0, len(arr) - 1
    while left <= right:
        mid = (left + right) // 2
        if arr[mid] == target:
            return mid
        elif arr[mid] < target:
            left = mid + 1
        else:
            right = mid - 1
    return -1

  That's it — the post is ready.