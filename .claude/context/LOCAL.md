# Local Context - Staz's Notes

## Project Overview

**ShoutOut** - Video/talent marketplace platform (think Cameo clone)

### Tech Stack
- **Frontend**: React + TypeScript
- **Backend**: Supabase (auth, database, edge functions, storage)
- **Payments**: Fortis (primary), Moov (payouts)
- **Banking**: Plaid (bank linking)
- **KYC**: Veriff
- **Storage**: Wasabi (S3-compatible), Cloudflare CDN
- **Email**: ActiveCampaign
- **SMS**: Custom edge functions

### Key Directories
- `src/components/` - React components (lots of them)
- `src/pages/` - Page components
- `src/context/` - Auth context
- `src/hooks/` - Custom hooks
- `supabase/functions/` - Edge functions (probably exists at sibling level)

### Code Quality Notes
- Always refer back .claude\commands\strict.md
- Vibe coded - expect inconsistencies
- Lots of markdown documentation files scattered around (100+)
- Never reference any markdown unless specificy
- Some deprecated/duplicate components likely exist
- Not following strict patterns - just make it work
- Always create doc file in .context-local directory
- Utilize codex mcp server as much as possible

### Common Tasks
- [ ] TODO: Add your testing notes here
- [ ] TODO: Track issues you find here

### Environment
- Check `.env.local` for local overrides
- Check `.env` for base config (committed)

### Gotchas
- (Add any gotchas you discover here)

---
*add notes here*
