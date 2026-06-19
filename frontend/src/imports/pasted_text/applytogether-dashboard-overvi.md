Design a premium dark-mode web app frontend for a product called ApplyTogether.

ApplyTogether is a shared job-application accountability dashboard. The first workspace is shared by two users, Jonathan and Kareem. Each user logs job applications they personally own, and both users can see all active applications in the shared workspace. Users can only edit, delete, or restore their own applications.

This is frontend design only. Do not design backend architecture. Do not design marketing pages. Do not design OAuth, password login, signup, invitations, workspace creation, workspace editing, membership management, role management, weekly goals, interview tracking, recruiter tracking, offer tracking, company CRM pages, AWS deployment, or admin settings.

The design should feel like Airtable practical meets premium SaaS dashboard:

* Practical, structured, spreadsheet-friendly
* Scalable from day one
* Dark color palette
* Premium but still implementation-friendly
* Clean and dense enough for real workflow usage
* Modern dashboard feel
* Strong use of tables, filters, cards, and detail pages
* Professional, not playful
* Collaborative/accountability-focused without feeling like a social app

Visual style:

* Dark background, near-black or deep navy base
* Elevated dark cards with subtle borders
* Muted slate surfaces
* White and light-gray text
* Blue or electric-indigo primary actions
* Green success accents
* Amber warning accents
* Red/destructive accents for rejected or deleted states
* Rounded corners
* Premium spacing
* Clean typography
* Subtle gradients only where they improve polish
* Avoid cartoon illustrations
* Avoid overly playful visuals
* Use practical SaaS iconography

Navigation:
Use a top navigation layout, not a left sidebar.

Top nav should include:

* ApplyTogether logo/name on the left
* Workspace selector showing “ApplyTogether”
* Navigation tabs:

  * Dashboard
  * Applications
  * Deleted
  * Workspace
  * Profile
* Development user switcher on the right:

  * “Viewing as Jonathan”
  * dropdown option for Kareem
* User avatar/name
* Primary button: “Add Application”

Important development note:
Authentication is simulated during development using X-User-Id. Include a development user switcher in the UI so someone testing the frontend can switch between Jonathan and Kareem.

Core product rules to reflect in the UI:

* Jonathan and Kareem share one workspace.
* Both can see all active applications.
* Each application has one owner.
* Only the owner can edit an application.
* Only the owner can soft-delete an application.
* Only the owner can restore a deleted application.
* Workspace owners cannot edit or delete another person’s applications.
* Deleted applications page only shows deleted applications owned by the current user.

Create the following screens/artboards:

1. Dashboard Overview
2. Applications List
3. Application Detail Page
4. Add Application Full Page Form
5. Edit Application Full Page Form
6. Deleted Applications Page
7. Deleted Application Detail Page
8. Workspace Page
9. Profile Page
10. Empty States
11. Error/Toast States
12. Mobile Responsive Dashboard
13. Mobile Responsive Applications List
14. Mobile Responsive Application Form

Screen 1: Dashboard Overview

Design a premium dashboard homepage.

Hero/header section:

* Title: “Track applications together”
* Subtitle: “A shared workspace for logging jobs, staying accountable, and keeping visibility across the search.”
* Primary button: “Add Application”
* Secondary button: “View Applications”

Include side-by-side accountability section:

* Two large user cards side by side:

  * Jonathan
  * Kareem
* Each card should show:

  * Avatar
  * Active applications count
  * Applications this week
  * Rejected count
  * Last application date
  * Small progress indicator
* Make this feel like accountability, not competition.

Include dashboard KPI cards:

* Total active applications
* Applications this week
* Recently updated
* Deleted applications owned by me

Include fake charts even if the backend does not yet have analytics endpoints. These are frontend/dashboard mockups only.

Charts to include:

* Applications by user: Jonathan vs Kareem
* Applications over time: last 8 weeks
* Status mix: Applied, Rejected, Withdrawn, Closed
* Work arrangement mix: Remote, Hybrid, Onsite, Unknown

Make charts look premium in dark mode:

* Subtle gridlines
* Clean labels
* Minimal legends
* No garish colors

Recent activity panel:
Show a feed with realistic activity:

* Jonathan added Strategic Finance Associate at Stripe
* Kareem updated Anthropic Finance & Strategy Analyst to Applied
* Jonathan deleted Ramp Business Operations Associate
* Kareem restored Datadog FP&A Analyst
* Jonathan changed Notion GTM Finance Associate to Closed

Activity feed should include timestamps like:

* 12 minutes ago
* 2 hours ago
* Yesterday

Screen 2: Applications List

Design the main active applications table page.

Top section:

* Page title: “Applications”
* Subtitle: “View every active application in the shared workspace.”
* Primary button: “Add Application”

Include a filter/search toolbar:

* Search input with placeholder: “Search company or job title”
* Owner filter dropdown: All owners, Jonathan, Kareem
* Status filter dropdown: All statuses, Applied, Rejected, Withdrawn, Closed
* Work arrangement dropdown: All, Remote, Hybrid, Onsite, Unknown
* Employment type dropdown: All, Full-time, Part-time, Contract, Internship, Temporary, Unknown
* Sort by dropdown:

  * Application date
  * Created date
  * Updated date
  * Company name
  * Job title
* Sort order toggle:

  * Asc
  * Desc
* Clear filters link

Design this like Airtable:

* Dense but readable
* Sticky-looking table header
* Row hover states
* Status pills
* Owner avatar chips
* Quick action menu
* Strong column alignment

Applications table columns:

* Company
* Role
* Owner
* Location
* Work arrangement
* Employment type
* Status
* Applied date
* Updated
* Actions

Sample active rows:

1. Stripe — Strategic Finance Associate — Jonathan — Remote — Full-time — Applied — Applied Jun 12, 2026
2. Anthropic — Finance & Strategy Analyst — Kareem — Hybrid — Full-time — Applied — Applied Jun 10, 2026
3. Ramp — Business Operations Associate — Jonathan — New York, NY — Onsite — Full-time — Rejected — Applied Jun 4, 2026
4. Datadog — FP&A Analyst — Kareem — Remote — Full-time — Withdrawn — Applied May 29, 2026
5. Notion — GTM Finance Associate — Jonathan — San Francisco, CA — Hybrid — Full-time — Closed — Applied May 22, 2026
6. Figma — Strategic Finance Manager — Kareem — Remote — Full-time — Applied — Applied May 20, 2026
7. OpenAI — Finance Operations Associate — Jonathan — Hybrid — Full-time — Applied — Applied May 18, 2026
8. Vercel — Business Operations Analyst — Kareem — Remote — Full-time — Applied — Applied May 14, 2026

For each row:

* Company cell should include company name and a subtle external-link indicator for the job posting URL
* Role cell should include job title
* Owner cell should show avatar and display name
* Status should be a pill
* Work arrangement should be a pill
* Employment type should be a pill
* Actions should include View, Edit, Delete

Ownership behavior:
When viewing as Jonathan:

* Jonathan-owned rows have enabled View, Edit, Delete
* Kareem-owned rows have View enabled, Edit/Delete disabled
* Disabled actions should have tooltip text:

  * “Only the application owner can edit this.”
  * “Only the application owner can delete this.”

When viewing as Kareem, reverse the same behavior.

Pagination:
At the bottom include:

* Previous
* Page numbers
* Next
* Page size selector: 10, 20, 50, 100
* Text: “Showing 1–20 of 42”

Screen 3: Application Detail Page

Design a full detail page, not a drawer.

The page should have:

* Breadcrumb: Applications / Stripe / Strategic Finance Associate
* Back button
* Large title area:

  * Company name
  * Job title
  * Owner avatar/name
  * Status pill
* Action buttons:

  * Edit Application
  * Delete Application
  * Open Job Posting

If the application is owned by the current user:

* Edit and Delete are enabled

If owned by another user:

* Edit and Delete are disabled
* Show notice:
  “You can view this because you share the workspace, but only the application owner can make changes.”

Detail layout:
Use premium dark cards and sections:

* Overview card

  * Company
  * Job title
  * Owner
  * Status
  * Application date
  * Location
  * Work arrangement
  * Employment type
* Compensation card

  * Salary min
  * Salary max
  * Salary currency
  * Salary period
* Job posting card

  * Original job posting URL
  * Normalized URL helper text
* Job description card
* Notes card
* Metadata card

  * Created date
  * Updated date
  * Deleted state if applicable

Screen 4: Add Application Full Page Form

Design a full-page form, not a modal.

Page title:
“Add Application”

Subtitle:
“Log a job application for your shared workspace. You will be the owner of this application.”

Include sections:

Section 1: Job basics
Fields:

* Company name, required
* Job title, required
* Job posting URL, required
* Location, required

Helper text under job posting URL:
“Used to prevent duplicate applications for the same posting.”

Section 2: Application details
Fields:

* Work arrangement, required dropdown:

  * Remote
  * Hybrid
  * Onsite
  * Unknown
* Employment type, required dropdown:

  * Full-time
  * Part-time
  * Contract
  * Internship
  * Temporary
  * Unknown
* Status dropdown, default Applied:

  * Applied
  * Rejected
  * Withdrawn
  * Closed
* Application date, optional
* Helper text:
  “Defaults to today if left blank.”

Section 3: Compensation
Fields:

* Salary min
* Salary max
* Salary currency, default USD
* Salary period:

  * Hourly
  * Monthly
  * Yearly

Helper text:
“Salary period is required when salary information is provided.”

Section 4: Details
Fields:

* Job description textarea
* Notes textarea

Bottom action bar:

* Cancel
* Save Application

Design requirements:

* Make required fields clear
* Show clean inline validation examples
* Use premium dark form styling
* Use full-page spacing with a centered max-width content column
* Include a right-side “Form tips” card on desktop
* On mobile, stack everything vertically

Screen 5: Edit Application Full Page Form

Use the same layout as Add Application but with prefilled values.

Page title:
“Edit Application”

Subtitle:
“Update the application details. Workspace and owner cannot be changed.”

Include a locked ownership/workspace card:

* Workspace: ApplyTogether
* Owner: Jonathan or Kareem
* Note: “Owner and workspace are assigned automatically and cannot be changed.”

Buttons:

* Cancel
* Save Changes

Screen 6: Deleted Applications Page

Design a page for deleted applications owned by the current user only.

Page title:
“Deleted Applications”

Subtitle:
“Only applications you deleted appear here. Restore an application before editing it.”

Include a table or card list with columns:

* Company
* Role
* Status
* Original application date
* Deleted date
* Actions

Actions:

* View
* Restore

Do not include permanent delete.

Sample deleted rows:

1. Coinbase — Finance Associate — Jonathan — Deleted Jun 13, 2026
2. Asana — Business Operations Analyst — Jonathan — Deleted Jun 8, 2026
3. Canva — FP&A Analyst — Jonathan — Deleted Jun 2, 2026

If viewing as Kareem, show Kareem-owned deleted applications instead.

Include helper notice:
“Deleted applications remain hidden from the active workspace list. Restoring makes them visible again.”

Screen 7: Deleted Application Detail Page

Design a detail page for a deleted application.

Include:

* Deleted status banner:
  “This application is deleted. Restore it before making edits.”
* Restore Application button
* Application details
* Deleted date
* Original application date
* Owner summary

Do not show Edit button while deleted.

Screen 8: Workspace Page

Design a simple but premium workspace page.

Page title:
“Workspace”

Show:

* Workspace name: ApplyTogether
* Current user role: Owner
* Workspace members:

  * Jonathan — Owner
  * Kareem — Owner

Include explanatory card:
“Workspace owners can manage workspace-level settings in future milestones. For now, application editing is based on application ownership, not workspace role.”

Do not include:

* Invite member button
* Remove member button
* Change role button
* Create workspace button
* Edit workspace button

Screen 9: Profile Page

Design a profile/current user page.

Show:

* Avatar placeholder
* Display name
* Email
* Active status
* Current workspace access
* Current development identity

Include development identity note:
“Authentication is simulated during development with the X-User-Id header.”

Include current user switcher card:

* Jonathan
* Kareem

Screen 10: Empty States

Design empty states for:

No active applications:
Title: “Start tracking your applications”
Text: “Add the first job application to begin building shared accountability.”
Button: “Add Application”

No search results:
Title: “No applications match your filters”
Text: “Try clearing filters or searching a different company or role.”
Button/link: “Clear filters”

No deleted applications:
Title: “No deleted applications”
Text: “Applications you delete will appear here.”
No primary button needed.

Screen 11: Error and Toast States

Design toast/banner states for:

Duplicate application:
“You have already recorded an application for this posting.”

Deleted duplicate exists:
“A deleted application already exists for this posting. Restore it instead of creating a duplicate.”

Ownership error:
“Only the application owner can make this change.”

Workspace access denied:
“You do not have access to this workspace.”

Validation error:
“Please review the highlighted fields.”

Database unavailable:
“The database is unavailable. Please try again later.”

Use consistent error styling:

* Toasts for short feedback
* Inline field errors for validation
* Page-level banners for access/database errors

Screen 12: Mobile Responsive Dashboard

Design the dashboard for mobile.

Mobile behavior:

* Top nav collapses into a compact header
* Navigation becomes a menu
* Add Application remains prominent
* Jonathan/Kareem accountability cards stack vertically
* Charts stack vertically
* Recent activity becomes a simple feed
* Keep dark premium styling

Screen 13: Mobile Responsive Applications List

On mobile:

* Replace table with stacked cards
* Each card shows:

  * Company
  * Job title
  * Owner
  * Status
  * Work arrangement
  * Employment type
  * Application date
  * Actions
* Filters collapse behind a “Filters” button
* Search remains visible at top
* Pagination remains simple

Screen 14: Mobile Responsive Application Form

On mobile:

* Full-page form
* Single-column layout
* Sticky bottom action bar with Cancel and Save
* Large tap targets
* Clean field spacing

Component system to create:

* Top navigation
* Workspace selector
* Development user switcher
* Avatar chip
* KPI card
* Accountability user card
* Chart card
* Activity feed item
* Search input
* Filter dropdown
* Sort dropdown
* Data table
* Mobile application card
* Status pill
* Work arrangement pill
* Employment type pill
* Action menu
* Form section
* Form input
* Textarea
* Inline validation message
* Page-level banner
* Toast notification
* Pagination
* Empty state card

Status pill colors:

* Applied: blue
* Rejected: red
* Withdrawn: gray
* Closed: amber

Work arrangement pill colors:

* Remote: green
* Hybrid: indigo or purple
* Onsite: slate
* Unknown: gray

Employment type pill colors:

* Full-time: blue
* Part-time: teal
* Contract: amber
* Internship: purple
* Temporary: orange
* Unknown: gray

Use realistic but fictional data.

Mock users:

* Jonathan
* Kareem

Mock workspace:

* ApplyTogether

Do not include real emails unless needed. If emails are shown, use fictional examples:

* [jonathan@example.com](mailto:jonathan@example.com)
* [kareem@example.com](mailto:kareem@example.com)

Make the app feel production-grade and scalable, as if this could eventually support more users and more workspaces, but keep the visible product scope limited to Milestone 1.

The final result should look like a premium, dark-mode, Airtable-inspired SaaS dashboard that Jonathan and Kareem could actually use every day to track job applications together.
