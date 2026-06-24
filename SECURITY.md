Here's a more professional and detailed version that you can use as a specification prompt for Codex, ChatGPT, Claude, Cursor, or any AI code reviewer:

---

# Comprehensive Architecture, Security, and Code Quality Audit

## Project Context

I am developing a production-grade movie and TV show recommendation platform called **Moodies**. The core differentiator of the platform is that recommendations are generated based on the user's current mood, combined with a highly interactive and gamified user experience.

The project originally began as a personal hobby project and evolved organically over time. As a result, some architectural decisions, code organization, naming conventions, and implementation patterns may no longer be suitable for a long-term production environment.

My primary objective is to transform the project into a maintainable, scalable, secure, and developer-friendly system that can support future contributors without introducing excessive complexity.

---

## Audit Objectives

Perform a complete review of the entire codebase, including but not limited to:

* Frontend architecture
* Backend architecture
* Database design
* Authentication and authorization
* API design
* State management
* File structure
* Naming conventions
* Dependency management
* Security practices
* Performance optimization
* Scalability considerations
* Developer experience (DX)
* Code consistency and maintainability

Do not limit the review to obvious issues. Identify even minor risks, inconsistencies, anti-patterns, or technical debt that could become problematic as the application grows.

---

## Security Review (Highest Priority)

Conduct a comprehensive security assessment of the entire application.

### Authentication & Authorization

Review for:

* Broken authentication mechanisms
* Missing authorization checks
* Role-based access control weaknesses
* Privilege escalation opportunities
* Session management issues
* Token handling vulnerabilities
* JWT implementation flaws
* Refresh token handling issues
* Password storage weaknesses
* Account enumeration risks

### API Security

Review for:

* Missing authentication requirements
* Missing authorization checks
* Insecure direct object references (IDOR)
* Excessive data exposure
* Overly permissive endpoints
* Sensitive information leakage
* Improper error handling
* Rate limiting gaps
* Abuse vectors
* Replay attack possibilities

### Database Security

Review for:

* SQL injection risks
* ORM misuse
* Unsafe query construction
* Sensitive data exposure
* Missing indexes causing denial-of-service risks
* Poor schema design affecting security
* Data integrity issues

### Frontend Security

Review for:

* XSS vulnerabilities
* Unsafe HTML rendering
* Insecure local storage usage
* Token exposure
* Client-side authorization assumptions
* Sensitive data leakage

### Infrastructure & Configuration

Review for:

* Exposed secrets
* Hardcoded credentials
* Environment variable misuse
* Insecure CORS configuration
* Insecure CSP configuration
* Missing security headers
* Logging sensitive information
* Insecure third-party integrations

### Dependency Security

Review for:

* Vulnerable packages
* Outdated dependencies
* Unnecessary dependencies
* High-risk dependencies
* Supply chain risks

---

## Scalability Review (Highest Priority)

Scalability is my most important architectural requirement.

Review whether the system can reasonably scale from:

* Hundreds of users
* Thousands of users
* Tens of thousands of users
* Hundreds of thousands of users

Identify bottlenecks including:

### Backend

* N+1 query problems
* Expensive database operations
* Inefficient API design
* Blocking operations
* Large payload transfers
* Memory inefficiencies
* Tight coupling

### Database

* Missing indexes
* Poor schema design
* Lack of normalization where necessary
* Over-normalization
* Query inefficiencies
* Future migration concerns

### Frontend

* Excessive re-renders
* Poor caching strategies
* Unnecessary API calls
* Bundle size issues
* State management inefficiencies

For every scalability concern, provide:

* Current issue
* Future impact
* Severity
* Recommended solution
* Example implementation

---

## Architecture Review

Analyze the overall architecture and determine whether it follows sound software engineering principles.

Review for:

### Separation of Concerns

Identify violations where:

* Business logic exists inside UI components
* Controllers contain business logic
* Data access is mixed with service logic
* Responsibilities are unclear

### Architectural Patterns

Evaluate whether the project would benefit from:

* Feature-based architecture
* Domain-driven design principles
* Clean Architecture
* Layered Architecture
* Modular Monolith architecture
* Event-driven patterns
* CQRS where appropriate

Do not recommend architecture purely because it is popular. Recommendations should be justified based on the project's size and goals.

---

## Code Quality Review

Review the entire codebase for:

### Maintainability

* Large files
* God components
* God services
* Duplicate logic
* Poor abstraction
* Tight coupling
* Weak cohesion

### Readability

* Naming inconsistencies
* Unclear function names
* Unclear variable names
* Poor folder organization
* Excessive nesting
* Complex logic flows

### Reusability

Identify areas where:

* Shared functionality should be extracted
* Hooks/services/utilities should be created
* Components should be generalized

---

## Project Structure Review

Evaluate whether the current folder structure is suitable for a growing team.

Provide:

### Current Problems

Explain:

* Why the current structure is problematic
* Which files are misplaced
* Which modules are overly coupled

### Recommended Structure

Provide a complete proposed directory structure.

Example:

```text
src/
├── modules/
│   ├── auth/
│   ├── users/
│   ├── recommendations/
│   ├── moods/
│   ├── watchlists/
│   └── reviews/
│
├── shared/
│   ├── components/
│   ├── hooks/
│   ├── services/
│   ├── types/
│   └── utils/
│
├── infrastructure/
├── database/
├── config/
└── tests/
```

Adapt recommendations to the actual project rather than forcing a generic structure.

---

## Technical Debt Assessment

Create a dedicated section that identifies:

### Critical Technical Debt

Issues that should be fixed immediately.

### Medium Technical Debt

Issues that should be addressed before major feature expansion.

### Low Priority Technical Debt

Issues that can wait but should be documented.

For each item include:

* Description
* Risk level
* Impact
* Estimated effort
* Recommended solution

---

## Refactoring Roadmap

Create a prioritized roadmap.

### Phase 1 – Critical Security Fixes

List all critical vulnerabilities.

### Phase 2 – Architecture Stabilization

List structural improvements.

### Phase 3 – Scalability Improvements

List performance and database optimizations.

### Phase 4 – Codebase Cleanup

List maintainability improvements.

### Phase 5 – Future Growth Preparation

List improvements that prepare the project for multiple developers.

---

## Output Requirements

For every issue discovered:

Provide:

* Severity (Critical / High / Medium / Low)
* File location
* Explanation
* Why it matters
* Potential impact
* Recommended solution
* Example code if applicable

Do not provide generic advice.

All recommendations must be based on actual findings from the codebase.

Prioritize actionable improvements that increase:

1. Security
2. Scalability
3. Maintainability
4. Developer onboarding speed
5. Long-term project sustainability

Assume this project is intended to evolve from a hobby application into a production-grade SaaS platform with multiple developers contributing in the future.

---

This prompt will force an AI reviewer to think more like a senior software architect, security engineer, and technical lead rather than giving generic code-review feedback.
