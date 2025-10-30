# ActiveCampaign Integration Setup

## Environment Variables Needed

Add these to your Railway environment variables (or `.env.local` for local development):

```bash
REACT_APP_ACTIVECAMPAIGN_API_KEY=your_api_key_here
REACT_APP_ACTIVECAMPAIGN_URL=https://shoutout94616.api-us1.com
```

## Getting Your API Key

1. Log into ActiveCampaign: https://shoutout94616.activehosted.com
2. Go to **Settings** → **Developer**
3. Copy your **API Key** and **API URL**
4. The API URL should be: `https://shoutout94616.api-us1.com`

## Required Lists

Make sure these lists exist in your ActiveCampaign account:

1. **beta** - For beta launch signups
2. **Master List** - For all contacts

The integration will automatically:
- Create/update contacts when they submit their email
- Add them to both the "beta" and "Master List" lists
- Mark them as subscribed (status = 1)

## Testing

After deploying with the environment variables:

1. Go to your landing page: https://shoutout.us
2. Submit an email address
3. Check ActiveCampaign to verify:
   - Contact was created
   - Contact appears in "beta" list
   - Contact appears in "Master List"

## Troubleshooting

- Check browser console for any errors
- Verify API key is correct and has proper permissions
- Make sure list names match exactly (case-insensitive): "beta" and "Master List"
- API calls are logged to console for debugging

## Notes

- Duplicate email submissions are handled gracefully (won't error if email already exists)
- The integration uses the ActiveCampaign v3 API
- Contacts are synced, not created, which means existing contacts will be updated

