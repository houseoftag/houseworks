# Email Classification Rubric

Classify each email into exactly one category. Return ONLY the label.

## Categories

### NEED_REPLY
The sender is asking a question, requesting something, or waiting on a response.
Examples: revision requests, deadline questions, approval requests, asking for deliverables.

### FYI
Informational — no action needed. Receipts, confirmations, status updates, file shares
where no reply is expected.

### LEAD
New business inquiry, warm introduction, or potential client outreach.
Someone expressing interest in services for the first time.

### VENDOR
Communication from a vendor, contractor, or service provider — not a client.
Invoices from vendors, contractor updates, tool/service notifications.

### IGNORE
Newsletter, promotional email, automated notification, spam, or marketing.
Anything that's clearly mass-sent or automated with no personal relevance.

## Rules
- If in doubt between NEED_REPLY and FYI, lean toward NEED_REPLY.
- Calendar invites with no message body are FYI.
- A forwarded email with "FYI" or "see below" is FYI.
- A forwarded email with "thoughts?" or "can you handle?" is NEED_REPLY.
