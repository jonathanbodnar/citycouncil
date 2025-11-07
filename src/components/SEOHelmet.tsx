import { Helmet } from 'react-helmet-async';

interface SEOHelmetProps {
  title?: string;
  description?: string;
  keywords?: string;
  image?: string;
  url?: string;
  type?: string;
}

export default function SEOHelmet({
  title = 'ShoutOut - Conservative & Faith-Based Video Shoutouts | Personalized Messages',
  description = 'Book personalized video messages from conservative voices, political commentators, faith leaders, and patriotic influencers. Authentic shoutouts for birthdays, events, and brand endorsements. The conservative alternative to Cameo.',
  keywords = 'conservative video message, faith-based influencer shoutout, patriotic celebrity video, political commentator message, Christian creator personalized video, personalized video gift, conservative influencer booking, video shoutout platform, faith leaders video message, patriot voices shoutout',
  image = 'https://shoutout.us/og-image.jpg',
  url = 'https://shoutout.us',
  type = 'website'
}: SEOHelmetProps) {
  return (
    <Helmet>
      {/* Primary Meta Tags */}
      <title>{title}</title>
      <meta name="title" content={title} />
      <meta name="description" content={description} />
      <meta name="keywords" content={keywords} />
      
      {/* Open Graph / Facebook */}
      <meta property="og:type" content={type} />
      <meta property="og:url" content={url} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={image} />
      <meta property="og:site_name" content="ShoutOut" />
      
      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:url" content={url} />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />
      
      {/* Additional SEO */}
      <meta name="robots" content="index, follow" />
      <meta name="language" content="English" />
      <meta name="revisit-after" content="7 days" />
      <meta name="author" content="ShoutOut" />
      
      {/* Geo targeting */}
      <meta name="geo.region" content="US" />
      <meta name="geo.placename" content="United States" />
      
      {/* Canonical URL */}
      <link rel="canonical" href={url} />
    </Helmet>
  );
}

