# Affiliate Links Feature - Implementation Checklist

## ✅ Completed
- [x] Add 'affiliate' to link_type union in BioLink interface
- [x] Add company_name and discount_amount fields to BioLink interface
- [x] Add affiliate_section_title to BioSettings interface
- [x] Add affiliate to linkTypes array in AddLinkModal
- [x] Add companyName and discountAmount state to AddLinkModal

## 🚧 In Progress / TODO
- [ ] Add TagIcon import to BioDashboard (for affiliate icon)
- [ ] Add affiliate form fields to AddLinkModal:
  - Company Name input
  - URL input
  - Image upload
  - Discount amount input (optional)
  - Section title customization
- [ ] Update handleSubmit to include company_name and discount_amount
- [ ] Create affiliate carousel display on BioPage
- [ ] Add section title editor in BioDashboard settings
- [ ] Create SQL migration:
  - Add company_name TEXT to bio_links
  - Add discount_amount TEXT to bio_links
  - Add affiliate_section_title TEXT to bio_settings

## Design Specs
- **Card Height:** Same as ShoutOut card
- **Image:** Rounded with shadow/border
- **Company Name:** All caps on glass banner at bottom
- **Discount Badge:** On image if discount exists
- **Section Title:** Default "Back the Brands That Support Me"
- **Carousel:** Horizontal scroll of affiliate logos
