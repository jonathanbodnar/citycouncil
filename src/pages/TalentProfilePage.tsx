import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { supabase } from '../services/supabase';
import { CheckCircleIcon, StarIcon } from '@heroicons/react/24/solid';

interface TalentProfile {
  id: string;
  full_name: string;
  slug: string;
  bio: string;
  category: string;
  pricing: number;
  profile_image_url: string;
  featured_video_url?: string;
  keywords?: string[];
  response_time?: string;
  total_orders?: number;
  rating?: number;
  is_active: boolean;
  instagram_handle?: string;
  twitter_handle?: string;
}

export default function TalentProfilePage() {
  const params = useParams<{ slug?: string; username?: string; id?: string }>();
  const slug = params.slug || params.username || params.id;
  const navigate = useNavigate();
  const [talent, setTalent] = useState<TalentProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTalent();
  }, [slug]);

  const fetchTalent = async () => {
    try {
      console.log('🔍 Fetching talent by slug:', slug);
      
      const { data, error } = await supabase
        .from('talent_profiles')
        .select(`
          id,
          slug,
          bio,
          category,
          pricing,
          keywords,
          total_orders,
          average_rating,
          is_active,
          promo_video_url,
          social_accounts,
          users!talent_profiles_user_id_fkey (
            full_name,
            avatar_url
          )
        `)
        .eq('slug', slug)
        .eq('is_active', true)
        .single();

      console.log('📦 Supabase response:', { data, error });

      if (error) {
        console.error('❌ Supabase error:', error);
        throw error;
      }
      
      if (!data) {
        console.error('❌ No data returned');
        return;
      }
      
      // Type assertion for joined data
      const userData = Array.isArray(data.users) ? data.users[0] : data.users;
      const socialAccounts = data.social_accounts as { instagram?: string; twitter?: string } | null;
      
      console.log('👤 User data:', userData);
      
      // Transform data to match interface
      const transformedData: TalentProfile = {
        id: data.id,
        slug: data.slug,
        full_name: userData?.full_name || '',
        bio: data.bio || '',
        category: data.category,
        pricing: data.pricing,
        profile_image_url: userData?.avatar_url || '',
        featured_video_url: data.promo_video_url || undefined,
        keywords: data.keywords || [],
        total_orders: data.total_orders || 0,
        rating: data.average_rating || 0,
        is_active: data.is_active,
        instagram_handle: socialAccounts?.instagram,
        twitter_handle: socialAccounts?.twitter,
        response_time: '24 hours' // Default
      };
      
      console.log('✅ Transformed talent data:', transformedData);
      setTalent(transformedData);
    } catch (error: any) {
      console.error('❌ Error fetching talent:', error);
      console.error('Error details:', error.message, error.details, error.hint);
    } finally {
      setLoading(false);
    }
  };

  const handleBookNow = () => {
    if (talent) {
      navigate(`/order/${talent.id}`);
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">
      <div className="text-xl">Loading...</div>
    </div>;
  }

  if (!talent) {
    return <div className="min-h-screen flex items-center justify-center">
      <div className="text-xl">Talent not found</div>
    </div>;
  }

  // Generate SEO-optimized content
  const categoryDisplay = talent.category.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  const seoTitle = `${talent.full_name} - Personalized Video Messages | Conservative & Faith-Based Shoutouts`;
  const seoDescription = `Book a personalized video message from ${talent.full_name}, ${categoryDisplay}. ${talent.bio?.substring(0, 120)}... Starting at $${talent.pricing}. Fast response time, authentic conservative values.`;
  const seoKeywords = [
    talent.full_name,
    `${talent.full_name} video message`,
    `${talent.full_name} shoutout`,
    'conservative video message',
    'faith-based influencer video',
    'patriotic celebrity shoutout',
    categoryDisplay.toLowerCase(),
    'personalized video gift',
    'custom video message',
    ...(talent.keywords || [])
  ].join(', ');

  // Structured data for Google
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Person",
    "name": talent.full_name,
    "description": talent.bio,
    "image": talent.profile_image_url,
    "jobTitle": categoryDisplay,
    "offers": {
      "@type": "Offer",
      "price": talent.pricing,
      "priceCurrency": "USD",
      "description": `Personalized video message from ${talent.full_name}`
    },
    "aggregateRating": talent.rating ? {
      "@type": "AggregateRating",
      "ratingValue": talent.rating,
      "reviewCount": talent.total_orders || 0
    } : undefined
  };

  return (
    <>
      <Helmet>
        <title>{seoTitle}</title>
        <meta name="description" content={seoDescription} />
        <meta name="keywords" content={seoKeywords} />
        
        {/* Open Graph */}
        <meta property="og:title" content={seoTitle} />
        <meta property="og:description" content={seoDescription} />
        <meta property="og:image" content={talent.profile_image_url} />
        <meta property="og:url" content={`https://shoutout.us/talent/${slug}`} />
        <meta property="og:type" content="profile" />
        
        {/* Twitter Card */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={seoTitle} />
        <meta name="twitter:description" content={seoDescription} />
        <meta name="twitter:image" content={talent.profile_image_url} />
        
        {/* Structured Data */}
        <script type="application/ld+json">
          {JSON.stringify(structuredData)}
        </script>
      </Helmet>

      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-red-50">
        <div className="max-w-7xl mx-auto px-4 py-12">
          {/* Breadcrumb for SEO */}
          <nav className="text-sm mb-6 text-gray-600">
            <a href="/" className="hover:text-blue-600">Home</a>
            <span className="mx-2">/</span>
            <a href={`/category/${talent.category}`} className="hover:text-blue-600 capitalize">
              {categoryDisplay}
            </a>
            <span className="mx-2">/</span>
            <span className="font-semibold">{talent.full_name}</span>
          </nav>

          <div className="grid md:grid-cols-2 gap-12">
            {/* Left: Image & Video */}
            <div>
              <div className="relative">
                <img 
                  src={talent.profile_image_url} 
                  alt={`${talent.full_name} - ${categoryDisplay} - Personalized Video Messages`}
                  className="w-full rounded-2xl shadow-2xl"
                />
                <div className="absolute top-4 right-4 bg-white px-4 py-2 rounded-full shadow-lg">
                  <span className="text-2xl font-bold text-blue-600">${talent.pricing}</span>
                </div>
              </div>

              {talent.featured_video_url && (
                <div className="mt-6">
                  <h3 className="text-lg font-semibold mb-3">Sample Video</h3>
                  <video 
                    src={talent.featured_video_url} 
                    controls 
                    className="w-full rounded-xl shadow-lg"
                  />
                </div>
              )}
            </div>

            {/* Right: Details & CTA */}
            <div>
              <h1 className="text-4xl font-bold mb-2">{talent.full_name}</h1>
              <p className="text-xl text-gray-600 mb-4 capitalize">{categoryDisplay}</p>

              {/* Trust Indicators */}
              <div className="flex items-center gap-4 mb-6 flex-wrap">
                <div className="flex items-center">
                  <CheckCircleIcon className="w-5 h-5 text-green-600 mr-1" />
                  <span className="text-sm">Verified Creator</span>
                </div>
                {talent.response_time && (
                  <div className="flex items-center">
                    <span className="text-sm">⚡ {talent.response_time} response</span>
                  </div>
                )}
                {talent.total_orders && talent.total_orders > 0 && (
                  <div className="flex items-center">
                    <StarIcon className="w-5 h-5 text-yellow-500 mr-1" />
                    <span className="text-sm">{talent.total_orders}+ videos</span>
                  </div>
                )}
              </div>

              {/* Bio */}
              <div className="mb-8">
                <h2 className="text-2xl font-bold mb-3">About {talent.full_name}</h2>
                <p className="text-gray-700 leading-relaxed whitespace-pre-line">
                  {talent.bio}
                </p>
              </div>

              {/* Keywords/Tags for SEO */}
              {talent.keywords && talent.keywords.length > 0 && (
                <div className="mb-8">
                  <div className="flex flex-wrap gap-2">
                    {talent.keywords.map((keyword, idx) => (
                      <span 
                        key={idx}
                        className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm"
                      >
                        {keyword}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* CTA Button */}
              <button
                onClick={handleBookNow}
                className="w-full bg-gradient-to-r from-blue-600 to-red-600 text-white py-4 rounded-xl font-bold text-lg shadow-xl hover:shadow-2xl transform hover:scale-105 transition-all"
              >
                Book Personalized Video - ${talent.pricing}
              </button>

              {/* What You Get */}
              <div className="mt-8 bg-gray-50 p-6 rounded-xl">
                <h3 className="font-bold mb-4">What You Get:</h3>
                <ul className="space-y-2 text-sm text-gray-700">
                  <li>✓ Personalized video message from {talent.full_name}</li>
                  <li>✓ Custom content tailored to your occasion</li>
                  <li>✓ High-quality video download</li>
                  <li>✓ Fast delivery ({talent.response_time || '24-48 hours'})</li>
                  <li>✓ Perfect for gifts, events, or brand endorsements</li>
                </ul>
              </div>

              {/* Social Links */}
              {(talent.instagram_handle || talent.twitter_handle) && (
                <div className="mt-6 flex gap-4">
                  {talent.instagram_handle && (
                    <a 
                      href={`https://instagram.com/${talent.instagram_handle}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-pink-600 hover:text-pink-800"
                    >
                      📷 Instagram
                    </a>
                  )}
                  {talent.twitter_handle && (
                    <a 
                      href={`https://twitter.com/${talent.twitter_handle}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-500 hover:text-blue-700"
                    >
                      🐦 Twitter
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* SEO Content Section */}
          <div className="mt-16 prose max-w-none">
            <h2>Book a Personalized Video Message from {talent.full_name}</h2>
            <p>
              Looking for a unique, personalized video gift? {talent.full_name} is available on ShoutOut.us 
              to create custom video messages for any occasion. Whether you need a birthday shoutout, 
              corporate endorsement, motivational message, or special surprise, {talent.full_name} delivers 
              authentic, high-quality personalized videos that make lasting memories.
            </p>
            
            <h3>Why Choose {talent.full_name} on ShoutOut.us?</h3>
            <ul>
              <li><strong>Authentic Conservative Values:</strong> ShoutOut.us is the leading platform for 
              conservative, patriotic, and faith-based video messages.</li>
              <li><strong>Fast Response Time:</strong> Get your personalized video in {talent.response_time || '24-48 hours'}.</li>
              <li><strong>Affordable Pricing:</strong> Starting at just ${talent.pricing} - much more 
              affordable than corporate alternatives.</li>
              <li><strong>Support Free Speech:</strong> Your purchase directly supports creators who share your values.</li>
            </ul>

            <h3>Perfect For:</h3>
            <ul>
              <li>Birthday surprises and anniversary gifts</li>
              <li>Wedding congratulations and celebrations</li>
              <li>Corporate events and brand endorsements</li>
              <li>Motivational messages and pep talks</li>
              <li>Political campaign endorsements</li>
              <li>Faith-based encouragement</li>
              <li>Patriotic holiday greetings</li>
            </ul>
          </div>
        </div>
      </div>
    </>
  );
}
