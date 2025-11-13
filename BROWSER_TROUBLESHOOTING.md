# Video Upload Browser Troubleshooting

## Common Browser Issues

### Safari
**Known Issues:**
- Large file uploads (>100MB) can fail silently
- AWS SDK compatibility issues
- Memory constraints with 500MB files
- CORS preflight issues

**Solutions:**
1. Try Chrome instead
2. Compress video before uploading
3. Clear browser cache
4. Ensure latest Safari version

### Chrome
**Usually Works Best**
- Best AWS SDK support
- Handles large files well
- Good CORS handling

**If Chrome Fails:**
1. Disable extensions (especially ad blockers)
2. Clear cache/cookies
3. Try Incognito mode

### Firefox
**Generally Good**
- Good large file support
- May have CORS issues

**Solutions:**
1. Check Enhanced Tracking Protection settings
2. Try disabling HTTPS-Only mode temporarily

### Edge
**Legacy Edge:**
- May have issues with large files
- Limited AWS SDK support

**New Edge (Chromium):**
- Should work like Chrome

## Debugging Steps

1. **Open Browser Console** (F12 → Console)
2. **Look for errors** with these keywords:
   - `CORS`
   - `aws-sdk`
   - `Failed to fetch`
   - `Network error`
   - `Access denied`

3. **Check Network Tab** (F12 → Network)
   - Look for failed requests to wasabisys.com
   - Check for 403/404/CORS errors

## Quick Fixes

1. **Try Chrome** (if not already using)
2. **Clear browser cache**
3. **Disable browser extensions**
4. **Check internet connection** (large uploads need stable connection)
5. **Try smaller video file** to test if size is the issue

## Error Messages

### "Upload failed" - Generic
- Could be file size (now 500MB max)
- Could be file type (must be video)
- Could be network timeout

### "Video must be less than 500MB"
- File is too large
- Compress video or use lower quality

### No error message, just fails
- Usually Safari issue
- Try Chrome

### "CORS error"
- Wasabi bucket CORS needs configuration
- Contact admin

### "Access denied"
- Wasabi credentials issue
- Contact admin

