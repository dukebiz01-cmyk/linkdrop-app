-- CAT-TABLE-FIX — business_categories 정본 테이블 + seed + partners FK + partner_kind DEFAULT
-- 토대 ②③: 등록 폼(④)의 업종 선택지 정본. 12 대분류 + 세부 ~100 (depth 2).
-- risk_level: medical 전부 restricted, professional의 legal/insurance/finance_advisory restricted, pet의 vet restricted.
-- business_type → business_categories.code FK 로 쓰레기값 차단 (#29 토대).
-- partner_kind DEFAULT 'store' 로 등록 코드가 partner_kind 안 다뤄도 됨.
-- 보존: 노을재 데이터(business_type=null) · partner_kind enum · approve_partner 무변경.
-- 롤백: Downloads/CAT-TABLE-ROLLBACK.sql

-- ─────────────────────────────────────────────────────────
-- Step 1 — business_categories 테이블 + RLS
-- ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.business_categories (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  code text UNIQUE NOT NULL,
  label text NOT NULL,
  parent_code text REFERENCES public.business_categories(code),
  depth int NOT NULL,
  risk_level text NOT NULL DEFAULT 'normal' CHECK (risk_level IN ('normal','restricted','prohibited')),
  is_active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.business_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS business_categories_public_read ON public.business_categories;
CREATE POLICY business_categories_public_read
  ON public.business_categories
  FOR SELECT
  TO public
  USING (is_active = true);

-- ─────────────────────────────────────────────────────────
-- Step 2 — seed (대분류 12 먼저, 세부 그 다음 — parent_code FK 전제)
-- ─────────────────────────────────────────────────────────

-- 대분류 12개 (depth 1)
INSERT INTO public.business_categories (code, label, parent_code, depth, risk_level, sort_order) VALUES
('stay_leisure','캠핑·펜션',NULL,1,'normal',1),
('food','맛집·외식',NULL,1,'normal',2),
('cafe_dessert','카페·디저트',NULL,1,'normal',3),
('beauty','미용·뷰티',NULL,1,'normal',4),
('realestate','부동산',NULL,1,'normal',5),
('medical','병원·의료',NULL,1,'restricted',6),
('pet','반려동물',NULL,1,'normal',7),
('education','교육·클래스',NULL,1,'normal',8),
('local_service','생활서비스',NULL,1,'normal',9),
('retail','쇼핑·상품',NULL,1,'normal',10),
('travel_event','여행·체험·이벤트',NULL,1,'normal',11),
('professional','전문상담',NULL,1,'normal',12)
ON CONFLICT (code) DO NOTHING;

-- 세부 (depth 2)
INSERT INTO public.business_categories (code, label, parent_code, depth, risk_level, sort_order) VALUES
-- stay_leisure
('camping_site','캠핑장','stay_leisure',2,'normal',1),
('pension','펜션','stay_leisure',2,'normal',2),
('glamping','글램핑','stay_leisure',2,'normal',3),
('caravan','카라반','stay_leisure',2,'normal',4),
('pool_villa','풀빌라','stay_leisure',2,'normal',5),
('guesthouse','게스트하우스','stay_leisure',2,'normal',6),
('resort','리조트','stay_leisure',2,'normal',7),
('camping_shop','캠핑용품점','stay_leisure',2,'normal',8),
('activity_lodging','체험형 숙박','stay_leisure',2,'normal',9),
-- food
('korean','한식','food',2,'normal',1),
('chinese','중식','food',2,'normal',2),
('japanese','일식','food',2,'normal',3),
('western','양식','food',2,'normal',4),
('meat_grill','고기집','food',2,'normal',5),
('seafood','해산물','food',2,'normal',6),
('bunsik','분식','food',2,'normal',7),
('lunch','백반·점심','food',2,'normal',8),
('pub_food','술집·안주','food',2,'normal',9),
('delivery_takeout','포장·배달','food',2,'normal',10),
('buffet','뷔페','food',2,'normal',11),
('family_restaurant','패밀리레스토랑','food',2,'normal',12),
-- cafe_dessert
('cafe','카페','cafe_dessert',2,'normal',1),
('dessert','디저트','cafe_dessert',2,'normal',2),
('bakery','베이커리','cafe_dessert',2,'normal',3),
('brunch','브런치','cafe_dessert',2,'normal',4),
('icecream_bingsu','아이스크림·빙수','cafe_dessert',2,'normal',5),
('takeout_coffee','테이크아웃 커피','cafe_dessert',2,'normal',6),
('tea_house','찻집','cafe_dessert',2,'normal',7),
-- beauty
('hair_salon','미용실','beauty',2,'normal',1),
('barber','바버샵','beauty',2,'normal',2),
('nail','네일','beauty',2,'normal',3),
('eyelash','속눈썹','beauty',2,'normal',4),
('waxing','왁싱','beauty',2,'normal',5),
('skin_care_nonmedical','피부관리실','beauty',2,'normal',6),
('scalp_care','두피관리','beauty',2,'normal',7),
('makeup','메이크업','beauty',2,'normal',8),
('spa','스파·마사지','beauty',2,'normal',9),
-- realestate
('realestate_agency','부동산 중개','realestate',2,'normal',1),
('apartment_sale','아파트 매매','realestate',2,'normal',2),
('villa_sale','빌라·주택','realestate',2,'normal',3),
('officetel','오피스텔','realestate',2,'normal',4),
('rent','전월세','realestate',2,'normal',5),
('commercial_space','상가·사무실','realestate',2,'normal',6),
('land','토지','realestate',2,'normal',7),
('new_sale','분양','realestate',2,'normal',8),
('move_in_service','입주 서비스','realestate',2,'normal',9),
-- medical (전부 restricted)
('dental','치과','medical',2,'restricted',1),
('plastic_surgery','성형외과','medical',2,'restricted',2),
('dermatology','피부과','medical',2,'restricted',3),
('oriental_medicine','한의원','medical',2,'restricted',4),
('checkup_center','검진센터','medical',2,'restricted',5),
('ophthalmology','안과','medical',2,'restricted',6),
('general_clinic','일반의원','medical',2,'restricted',7),
('orthopedics','정형외과','medical',2,'restricted',8),
('pediatrics','소아과','medical',2,'restricted',9),
('women_clinic','여성의원','medical',2,'restricted',10),
-- pet
('vet','동물병원','pet',2,'restricted',1),
('pet_grooming','애견미용','pet',2,'normal',2),
('pet_hotel','반려동물 호텔','pet',2,'normal',3),
('pet_cafe','펫카페','pet',2,'normal',4),
('pet_training','훈련소','pet',2,'normal',5),
('pet_goods','반려동물 용품','pet',2,'normal',6),
-- education
('academy','학원','education',2,'normal',1),
('tutoring','과외','education',2,'normal',2),
('language','어학','education',2,'normal',3),
('music_art','음악·미술','education',2,'normal',4),
('sports_class','운동 클래스','education',2,'normal',5),
('workshop','공방','education',2,'normal',6),
('one_day_class','원데이클래스','education',2,'normal',7),
('coding_class','코딩·IT','education',2,'normal',8),
('exam_prep','시험 준비','education',2,'normal',9),
-- local_service
('cleaning','청소','local_service',2,'normal',1),
('moving','이사','local_service',2,'normal',2),
('interior','인테리어','local_service',2,'normal',3),
('repair','수리','local_service',2,'normal',4),
('laundry','세탁','local_service',2,'normal',5),
('photo_studio','사진관','local_service',2,'normal',6),
('rental','렌탈','local_service',2,'normal',7),
('storage','보관','local_service',2,'normal',8),
('car_wash','세차','local_service',2,'normal',9),
('car_repair','자동차 정비','local_service',2,'normal',10),
-- retail
('fashion','의류','retail',2,'normal',1),
('beauty_product','화장품','retail',2,'normal',2),
('camping_gear','캠핑용품','retail',2,'normal',3),
('electronics','전자제품','retail',2,'normal',4),
('flower_gift','꽃·선물','retail',2,'normal',5),
('local_store','동네가게','retail',2,'normal',6),
('furniture','가구','retail',2,'normal',7),
('living_goods','생활용품','retail',2,'normal',8),
('kids_goods','유아·키즈','retail',2,'normal',9),
-- travel_event
('tour','여행·투어','travel_event',2,'normal',1),
('festival','축제','travel_event',2,'normal',2),
('exhibition','전시','travel_event',2,'normal',3),
('performance','공연','travel_event',2,'normal',4),
('theme_park','테마파크','travel_event',2,'normal',5),
('leisure_sports','레저스포츠','travel_event',2,'normal',6),
('activity','체험장','travel_event',2,'normal',7),
('ticket','티켓','travel_event',2,'normal',8),
-- professional (법률·보험·재무상담 restricted)
('tax','세무','professional',2,'normal',1),
('labor','노무','professional',2,'normal',2),
('legal','법률','professional',2,'restricted',3),
('insurance','보험','professional',2,'restricted',4),
('consulting','컨설팅','professional',2,'normal',5),
('wedding','웨딩','professional',2,'normal',6),
('funeral','장례','professional',2,'normal',7),
('finance_advisory','재무상담','professional',2,'restricted',8)
ON CONFLICT (code) DO NOTHING;

-- ─────────────────────────────────────────────────────────
-- Step 3 — partners ALTER (DEFAULT + FK)
-- ─────────────────────────────────────────────────────────

-- partner_kind DEFAULT 'store'
ALTER TABLE public.partners ALTER COLUMN partner_kind SET DEFAULT 'store';

-- business_type → business_categories.code FK
ALTER TABLE public.partners
  DROP CONSTRAINT IF EXISTS partners_business_type_fkey;
ALTER TABLE public.partners
  ADD CONSTRAINT partners_business_type_fkey
  FOREIGN KEY (business_type) REFERENCES public.business_categories(code);
