# InstituteOS — Phase Review Checklist

Do not move to the next phase until the relevant checks are satisfied.

## Workspace

- [ ] Correct repository/workspace open
- [ ] Git status understood
- [ ] No unexplained destructive changes
- [ ] No secrets committed

## Functionality

- [ ] Intended feature works
- [ ] Success state works
- [ ] Empty state works
- [ ] Loading state works
- [ ] Error state works
- [ ] Permission-denied state works where relevant
- [ ] Responsive behavior checked where relevant

## Backend

- [ ] Routes registered
- [ ] Validation present
- [ ] Authentication correct
- [ ] Authorization correct
- [ ] Tenant scoping correct
- [ ] Business logic in appropriate layer
- [ ] Errors handled consistently
- [ ] Logging safe

## Database

- [ ] Schema reviewed
- [ ] Required fields reviewed
- [ ] Indexes considered
- [ ] Tenant filters verified
- [ ] Duplicate/conflict rules considered

## AI

- [ ] Permission-aware
- [ ] Tenant-aware
- [ ] Tool arguments validated
- [ ] Outputs validated where needed
- [ ] Usage/rate limits considered
- [ ] Prompt injection risks reviewed

## Quality

- [ ] Tests run
- [ ] Typecheck passes
- [ ] Lint passes
- [ ] Build passes if applicable
- [ ] Manual smoke test completed

## Documentation

- [ ] README/docs updated
- [ ] Important decisions recorded
- [ ] Known limitations recorded
- [ ] PROJECT_STATE.md updated

## Human understanding

- [ ] I can explain the main architecture
- [ ] I can explain why the main design choices exist
- [ ] I can explain the main security boundary
- [ ] I can explain the main data flow
- [ ] I can explain what changed in this phase
