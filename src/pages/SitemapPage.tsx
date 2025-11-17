import { useEffect, useState } from 'react';
import { supabase } from '../services/supabase';

interface TalentProfile {
  id: string;
  full_name: string;
  slug: string;
  category: string;
  bio: string;
  keywords: string[];
  updated_at: string;
}

export default function SitemapPage() {
  const [xml, setXml] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    generateSitemap();
  }, []);

  const generateSitemap = async () => {
    try {
      // Fetch all active talent profiles
      const { data: talents, error} = await supabase
        .from('talent_profiles')
        .select('id, full_name, slug, category, bio, keywords, updated_at')
        .eq('is_active', true)
        .order('full_name');

      if (error) throw error;

      // Generate XML sitemap
      const baseUrl = 'https://shoutout.us';
      const now = new Date().toISOString().split('T')[0];

      let sitemapXml = '<?xml version="1.0" encoding="UTF-8"?>\n';
      sitemapXml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

      // Homepage - highest priority
      sitemapXml += `  <url>
    <loc>${baseUrl}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>\n`;

      // About page - important public content
      sitemapXml += `  <url>
    <loc>${baseUrl}/about</loc>
    <lastmod>${now}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>\n`;

      // Individual talent profiles - use slug format (e.g., shoutout.us/shawnfarash)
      // Categories are browseable on the homepage, not separate pages
      talents?.forEach(talent => {
        const lastMod = talent.updated_at ? new Date(talent.updated_at).toISOString().split('T')[0] : now;
        
        // Only include talents with a username (skip old /profile/ URLs)
        if (talent.slug) {
          sitemapXml += `  <url>
    <loc>${baseUrl}/${talent.slug}</loc>
    <lastmod>${lastMod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
  </url>\n`;
        }
      });

      sitemapXml += '</urlset>';

      setXml(sitemapXml);
      setLoading(false);
    } catch (error) {
      console.error('Error generating sitemap:', error);
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center">Generating sitemap...</div>;
  }

  return (
    <pre className="p-4 bg-gray-100 overflow-auto text-xs">
      {xml}
    </pre>
  );
}

