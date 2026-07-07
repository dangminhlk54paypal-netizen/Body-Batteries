// AUTO-GENERATED from food_items.csv — DO NOT EDIT BY HAND.
// Edit food_items.csv, then run `npm run gen:food` to regenerate.
export const FOOD_CSV_RAW = `id,name_vi,name_en,category,default_serving_g,serving_presets,energy_kcal,water_g,protein_g,fat_g,carb_g,fiber_g,sugar_g,calcium_mg,iron_mg,sodium_mg,potassium_mg,magnesium_mg,zinc_mg,source,note,epa_mg,dha_mg,name_de
rice_white_cooked,Cơm trắng (gạo tẻ nấu chín),"White rice, cooked",grain,150,chén=150|bát=250,130,68.4,2.7,0.3,28.2,0.4,0.1,10,0.2,1,35,12,0.5,USDA,Cơm tẻ nấu chín,,,Reis (gekocht)
rice_brown_cooked,Gạo lứt (nấu chín),"Brown rice, cooked",grain,150,chén=150|bát=250,111,73,2.6,0.9,23,1.8,0.4,10,0.5,5,43,43,0.6,USDA,,,,Brauner Reis (gekocht)
rice_raw,Gạo tẻ (sống),"White rice, raw",grain,100,lon=180,360,11,7.5,1.0,79,0.4,0.1,30,1.3,5,115,25,1.1,VN-FCT,,,,Reis (roh)
rice_noodle_pho,Bánh phở (chín),"Rice noodle (pho), cooked",grain,180,phần=180,109,72,0.9,0.2,25,1.0,0.0,4,0.1,19,8,,,USDA,,,,"Reisnudeln (Pho, gekocht)"
bun_vermicelli,Bún (chín),"Rice vermicelli, cooked",grain,180,phần=180,110,72,0.9,0.2,25,1.0,0.0,4,0.1,10,,,,USDA,,,,Reisvermicelli (gekocht)
bread_baguette,Bánh mì (ổ không),Baguette bread,grain,90,ổ=90,261,35,9.0,3.2,49,2.7,3.0,54,3.0,491,115,23,0.9,USDA,,,,Baguette
sweet_potato,Khoai lang,Sweet potato,grain,130,củ=130,86,77,1.6,0.1,20,3.0,4.2,30,0.6,55,337,25,0.3,USDA,,,,Süßkartoffel
potato,Khoai tây,Potato,grain,130,củ=130,77,79,2.0,0.1,17,2.2,0.8,12,0.8,6,421,23,0.3,USDA,,,,Kartoffel
corn,Ngô / bắp,Sweet corn,grain,100,bắp=120,86,76,3.2,1.2,19,2.7,3.2,2,0.5,15,270,37,0.5,USDA,,,,Mais (Zuckermais)
oats,Yến mạch,Oats,grain,40,phần=40,389,8,16.9,6.9,66,10.6,0.0,54,4.7,2,429,177,4.0,USDA,,,,Haferflocken
instant_noodle,Mì ăn liền,Instant noodles,grain,75,gói=75,436,6,9.0,17,63,2.0,2.0,20,4.0,1700,,,,estimate,Natri rất cao; thay đổi theo hãng,,,Instantnudeln
chicken_breast,Ức gà,"Chicken breast, cooked",meat,100,miếng=120,165,65,31,3.6,0,0,0,15,1.0,74,256,29,1.0,USDA,,,,Hähnchenbrust
chicken_thigh,Đùi gà,"Chicken thigh, cooked",meat,100,cái=110,209,60,26,11,0,0,0,12,1.3,88,230,23,2.1,USDA,,,,Hähnchenschenkel (gegart)
pork_lean,Thịt lợn nạc,"Lean pork, cooked",meat,100,phần=100,143,72,21,6,0,0,0,7,0.9,55,380,24,2.4,VN-FCT,,,,Mageres Schweinefleisch (gegart)
pork_belly,Thịt ba chỉ,Pork belly,meat,80,phần=80,518,37,9.3,53,0,0,0,5,0.7,32,185,,,USDA,,,,Schweinebauch
pork_ribs,Sườn lợn,Pork ribs,meat,100,phần=100,277,55,20,21,0,0,0,15,1.0,80,300,,,estimate,,,,Schweinerippchen
beef_lean,Thịt bò nạc,"Lean beef, cooked",meat,100,phần=100,217,60,26,12,0,0,0,12,2.6,55,330,21,6.3,USDA,,,,Mageres Rindfleisch (gegart)
duck_meat,Thịt vịt,Duck meat,meat,100,phần=100,337,52,19,28,0,0,0,11,2.7,63,204,,,USDA,,,,Entenfleisch
fish_scad,Cá nục,Scad mackerel,fish,100,con=120,111,72,21,3.3,0,0,0,85,1.1,90,350,30,0.9,VN-FCT,,230,560,Stöcker (Bastardmakrele)
fish_salmon,Cá hồi,Salmon,fish,100,phần=120,208,64,20,13,0,0,0,9,0.3,59,363,27,0.4,USDA,,690,1457,Lachs
fish_basa,Cá basa,Basa fish,fish,100,phần=120,166,70,23,7,0,0,0,12,0.3,50,300,,,estimate,,,,Basa-Fisch (Pangasius)
tuna,Cá ngừ,Tuna,fish,100,phần=100,132,68,28,1.3,0,0,0,8,1.0,47,252,50,0.5,USDA,,,,Thunfisch
shrimp,Tôm,Shrimp,fish,80,phần=80,99,75,24,0.3,0.2,0,0,70,0.5,111,259,39,1.6,USDA,,,,Garnelen
squid,Mực,Squid,fish,80,phần=80,92,79,15.6,1.4,3.1,0,0,32,0.7,44,246,33,1.5,USDA,,,,Tintenfisch
egg_chicken,Trứng gà,Chicken egg,egg_dairy,50,quả=50,155,76,13,11,1.1,0,1.1,50,1.2,124,126,10,1.1,USDA,,,,Hühnerei
egg_duck,Trứng vịt,Duck egg,egg_dairy,70,quả=70,185,70,13,14,1.5,0,0.9,64,3.9,146,222,,,USDA,,,,Entenei
milk_whole,Sữa tươi,Whole milk,egg_dairy,200,ly=200|hộp=180,61,88,3.2,3.3,4.8,0,5.1,113,0.0,43,132,10,0.4,USDA,,,,Vollmilch (frisch)
yogurt,Sữa chua,"Yogurt, plain",egg_dairy,100,hộp=100,59,88,3.5,3.3,4.7,0,4.7,121,0.1,46,155,12,0.6,USDA,,,,Joghurt (natur)
cheese,Phô mai,Cheese (cheddar),egg_dairy,30,lát=20,402,37,25,33,1.3,0,0.5,721,0.7,621,98,28,3.6,USDA,,,,Käse (Cheddar)
tofu,Đậu phụ,Tofu,legume_nut,100,bìa=100,76,84,8.1,4.8,1.9,0.3,0.6,350,5.4,7,121,30,0.8,USDA,,,,Tofu
soybean,Đậu nành,Soybean,legume_nut,50,phần=50,446,8,36,20,30,9.3,7.3,277,15.7,2,1797,280,4.9,USDA,,,,Sojabohne
mung_bean,Đậu xanh,Mung bean,legume_nut,50,phần=50,347,9,24,1.2,63,16,6.6,132,6.7,15,1246,189,2.7,USDA,,,,Mungobohne
black_bean,Đậu đen,Black bean,legume_nut,50,phần=50,341,11,21,1.4,62,15,2.1,123,5.0,5,1483,171,3.7,USDA,,,,Schwarze Bohne
peanut,Lạc / đậu phộng,Peanut,legume_nut,30,nắm=30,567,6,26,49,16,8.5,4.7,92,4.6,18,705,168,3.3,USDA,,,,Erdnuss
cashew,Hạt điều,Cashew,legume_nut,30,nắm=30,553,5,18,44,30,3.3,5.9,37,6.7,12,660,292,5.8,USDA,,,,Cashewkern
almond,Hạnh nhân,Almond,legume_nut,30,nắm=30,579,4,21,50,22,12.5,4.4,269,3.7,1,733,270,3.1,USDA,,,,Mandel
water_spinach,Rau muống,Water spinach,vegetable,100,phần=100,19,92,2.6,0.2,3.1,2.1,0.5,77,1.7,113,312,71,0.2,USDA,,,,Wasserspinat
cabbage,Bắp cải,Cabbage,vegetable,100,phần=100,25,92,1.3,0.1,5.8,2.5,3.2,40,0.5,18,170,12,0.2,USDA,,,,Weißkohl
carrot,Cà rốt,Carrot,vegetable,80,củ=80,41,88,0.9,0.2,9.6,2.8,4.7,33,0.3,69,320,12,0.2,USDA,,,,Karotte
tomato,Cà chua,Tomato,vegetable,100,quả=120,18,95,0.9,0.2,3.9,1.2,2.6,10,0.3,5,237,11,0.2,USDA,,,,Tomate
cucumber,Dưa leo,Cucumber,vegetable,100,quả=150,15,95,0.7,0.1,3.6,0.5,1.7,16,0.3,2,147,13,0.2,USDA,,,,Gurke
broccoli,Bông cải xanh,Broccoli,vegetable,100,phần=100,34,89,2.8,0.4,6.6,2.6,1.7,47,0.7,33,316,21,0.4,USDA,,,,Brokkoli
pumpkin,Bí đỏ,Pumpkin,vegetable,100,phần=100,26,92,1.0,0.1,6.5,0.5,2.8,21,0.8,1,340,12,0.3,USDA,,,,Kürbis
mushroom,Nấm,Mushroom,vegetable,80,phần=80,22,92,3.1,0.3,3.3,1.0,2.0,3,0.5,5,318,9,0.5,USDA,,,,Pilz (Champignon)
bean_sprouts,Giá đỗ,Bean sprouts,vegetable,50,phần=50,30,90,3.0,0.2,5.9,1.8,4.1,13,0.9,6,149,21,0.4,USDA,,,,Sojasprossen
morning_glory,Cải ngọt,Choy sum / mustard greens,vegetable,100,phần=100,13,95,1.5,0.2,2.2,1.0,1.0,105,0.8,20,250,,,estimate,,,,Senfgemüse (Choy Sum)
banana,Chuối,Banana,fruit,120,quả=120,89,75,1.1,0.3,23,2.6,12,5,0.3,1,358,27,0.2,USDA,,,,Banane
apple,Táo,Apple,fruit,150,quả=150,52,86,0.3,0.2,14,2.4,10,6,0.1,1,107,5,0.0,USDA,,,,Apfel
orange,Cam,Orange,fruit,130,quả=130,47,87,0.9,0.1,12,2.4,9.4,40,0.1,0,181,10,0.1,USDA,,,,Orange
mango,Xoài,Mango,fruit,150,quả=200,60,83,0.8,0.4,15,1.6,14,11,0.2,1,168,10,0.1,USDA,,,,Mango
papaya,Đu đủ,Papaya,fruit,150,phần=150,43,88,0.5,0.3,11,1.7,7.8,20,0.3,8,182,21,0.1,USDA,,,,Papaya
watermelon,Dưa hấu,Watermelon,fruit,200,phần=200,30,91,0.6,0.2,7.6,0.4,6.2,7,0.2,1,112,10,0.1,USDA,,,,Wassermelone
guava,Ổi,Guava,fruit,120,quả=120,68,81,2.6,1.0,14,5.4,8.9,18,0.3,2,417,22,0.2,USDA,,,,Guave
dragon_fruit,Thanh long,Dragon fruit,fruit,150,phần=150,60,85,1.2,0.0,13,3.0,8.0,9,0.7,0,170,,,estimate,,,,Drachenfrucht (Pitahaya)
cooking_oil,Dầu ăn,Cooking oil,fat_sugar,10,thìa=10,884,0,0,100,0,0,0,,,0,,,,USDA,,,,Speiseöl
sugar,Đường,Sugar,fat_sugar,8,thìa=8,387,0,0,0,100,0,100,,,1,,,,USDA,,,,Zucker
honey,Mật ong,Honey,fat_sugar,20,thìa=20,304,17,0.3,0,82,0.2,82,6,0.4,4,52,,,USDA,,,,Honig
fish_sauce,Nước mắm,Fish sauce,fat_sugar,10,thìa=10,35,71,5.1,0,3.6,0,3.6,43,0.8,7851,288,,,USDA,Natri cực cao,,,Fischsauce
dish_pho_bo,Phở bò,Beef pho,dish,500,bát=500|tô lớn=650,90,,6.0,2.0,10.5,0.5,1.0,,,300,,,,web-estimate,~450 kcal/bát; natri cao,,,Pho Bo (Rindfleisch-Nudelsuppe)
dish_pho_ga,Phở gà,Chicken pho,dish,500,bát=500|tô lớn=650,85,,6.0,1.6,10.0,0.5,1.0,,,290,,,,web-estimate,~400 kcal/bát,,,Pho Ga (Hähnchen-Nudelsuppe)
dish_bun_bo_hue,Bún bò Huế,Bun bo Hue,dish,500,bát=500,110,,6.4,2.8,13.0,0.5,1.4,,,340,,,,web-estimate,"~550 kcal/bát; cay, natri cao",,,Bun Bo Hue (scharfe Rindfleischsuppe)
dish_bun_cha,Bún chả,Bun cha,dish,450,suất=450,110,,7.0,4.0,12.0,0.6,2.0,,,320,,,,web-estimate,~385-500 kcal/suất,,,Bun Cha (gegrilltes Schwein mit Reisnudeln)
dish_com_tam,Cơm tấm sườn,Broken rice with pork chop,dish,400,đĩa=400,141,,6.3,4.5,17.5,0.5,1.5,,,300,,,,web-estimate,~565 kcal/đĩa sườn,,,Com Tam (Bruchreis mit Schweinekotelett)
dish_banh_mi,Bánh mì thịt,Banh mi (pork),dish,180,ổ=180,233,,9.0,9.0,28.0,1.5,3.0,,,450,,,,web-estimate,~420 kcal/ổ,,,Banh Mi (vietnamesisches Sandwich)
dish_goi_cuon,Gỏi cuốn,Fresh spring roll,dish,50,cuốn=50,110,,8.0,2.0,15.0,1.0,1.5,,,200,,,,web-estimate,~55 kcal/cuốn,,,Frühlingsrolle (frisch)
dish_cha_gio,Chả giò / nem rán,Fried spring roll,dish,30,cuốn=30,230,,9.0,12.0,22.0,1.0,1.5,,,300,,,,web-estimate,~110 kcal/cuốn (chiên),,,Frühlingsrolle (frittiert)
dish_com_chien,Cơm chiên,Fried rice,dish,300,đĩa=300,163,,4.0,5.0,25.0,0.6,1.0,,,380,,,,estimate,~490 kcal/đĩa,,,Gebratener Reis
dish_xoi,Xôi,Sticky rice,dish,200,phần=200,170,,3.0,2.0,35.0,0.6,0.5,,,10,,,,estimate,~340 kcal/phần,,,Klebreis
dish_chao,Cháo,Rice porridge,dish,350,bát=350,50,,1.5,0.6,10.0,0.2,0.2,,,200,,,,estimate,,,,Reisbrei (Congee)
dish_hu_tieu,Hủ tiếu,Hu tieu noodle soup,dish,450,bát=450,95,,5.0,2.0,13.0,0.4,1.0,,,320,,,,estimate,~430 kcal/bát,,,Hu Tieu (Nudelsuppe)
dish_mi_quang,Mì Quảng,Mi Quang,dish,450,bát=450,120,,6.0,4.0,15.0,0.5,1.0,,,330,,,,estimate,,,,Mi Quang (Nudelgericht)
dish_banh_xeo,Bánh xèo,Vietnamese pancake,dish,150,cái=150,200,,6.0,11.0,19.0,1.0,1.5,,,300,,,,estimate,~300 kcal/cái,,,Banh Xeo (vietnamesischer Pfannkuchen)
dish_canh_chua,Canh chua,Sour soup,dish,300,bát=300,40,,3.0,1.0,5.0,0.8,2.0,,,350,,,,estimate,,,,Saure Suppe (Canh Chua)
beer_lager,Bia (lager/pils),Beer lager (4.9% vol),drink,500,lon=330|lon lớn=500,43,92,0.5,0,3.2,0,0,4,0,4,27,6,0,USDA,Đã gồm năng lượng từ cồn,,,Bier (Pils)
coffee_black,Cà phê đen (không đường),"Coffee, black",drink,240,tách=240|espresso=30,1,99,0.1,0,0,0,0,2,0,2,49,3,0,USDA,Không đường không sữa,,,Kaffee schwarz (ohne Zucker)
cappuccino,Cappuccino (sữa tươi),Cappuccino,drink,180,tách=180,27,90,1.6,1.4,2.4,0,2.4,55,0,20,80,5,0.2,label,Ước tính với sữa nguyên kem,,,Cappuccino
cola,Coca-Cola,Cola,drink,330,lon=330|chai=500,42,90,0,0,10.6,0,10.6,2,0,4,2,0,0,label,,,,Cola
cola_zero,Coca-Cola Zero,Cola Zero,drink,330,lon=330|chai=500,0,100,0,0,0,0,0,2,0,4,2,0,0,label,Ngọt nhân tạo ~0 kcal,,,Cola Zero
redbull,Red Bull,Red Bull energy drink,drink,250,lon=250,45,89,0,0,11,0,11,0,0,40,0,0,0,label,Caffeine 32mg/100ml,,,Red Bull (Energy Drink)
fish_oil_omega3,Dầu cá Omega-3 (viên 1220mg),Fish oil omega-3 capsule,supplement,1.22,viên=1.22|2 viên=2.44,900,0,0,100,0,0,0,0,0,0,0,0,0,label,1 viên 1220mg dầu = 600mg EPA + 400mg DHA (~11 kcal),49180,32787,Omega-3 Fischölkapsel
whey_protein,Whey protein (1 muỗng 30g),Whey protein powder (HSN),supplement,30,muỗng=30,375,5,76,5,8,0,6,400,0,180,450,60,1.5,label,Pha với nước; sữa tính riêng,,,Whey Protein Pulver
ginkgo,Ginkgo biloba (viên),Ginkgo biloba tablet,supplement,0.5,viên=0.5,0,0,0,0,0,0,0,0,0,0,0,0,0,label,Calo không đáng kể — ghi để theo dõi thói quen,,,Ginkgo Biloba Tablette
vitamin_d3_k2,Vitamin D3 + K2 (viên/giọt),Vitamin D3 + K2,supplement,0.2,viên=0.2,0,0,0,0,0,0,0,0,0,0,0,0,0,label,Calo không đáng kể — ghi để theo dõi thói quen,,,Vitamin D3 + K2 (Tropfen/Tablette)
croissant,Bánh sừng bò (croissant bơ),"Croissant, butter",snack,65,cái=65,406,23,8.2,21,45.8,2.6,11.3,37,2,424,118,16,0.7,USDA,,,,Butter-Croissant
broetchen,Bánh mì tròn Đức (Brötchen),German bread roll (Brötchen),snack,60,cái=60,265,32,8.5,1.8,53,3,2,50,1.5,500,130,25,0.9,label,Loại trắng thường ở Penny/REWE/Netto,,,Brötchen
brezel,Bánh xoắn muối (Brezel),Soft pretzel (Laugenbrezel),snack,85,cái=85,338,22,8.2,3.1,69.4,1.7,0.8,23,3.9,1240,88,21,0.9,USDA,Mặn — nhiều natri,,,Brezel (Laugenbrezel)
donut_glazed,Bánh donut (phủ đường),"Doughnut, glazed",snack,60,cái=60,421,21,5.2,22.8,50.8,1.5,22.9,60,1.6,364,102,17,0.6,USDA,,,,Donut (glasiert)
muffin_choc,Bánh muffin sô-cô-la,Chocolate muffin,snack,110,cái=110,405,20,5.5,20.6,50,2.5,30,60,1.8,340,150,25,0.7,label,Loại siêu thị Đức,,,Schoko-Muffin
danish_pastry,Bánh ngọt Đan Mạch (Plunder),Danish pastry,snack,80,cái=80,371,22,6,20.5,42,1.5,17,50,1.7,350,90,14,0.7,USDA,,,,Plundergebäck
butterkeks,Bánh quy bơ (Butterkeks),Butter biscuit,snack,25,cái=6|khẩu phần=25,443,3,7.5,14,71,2.5,20,30,1.5,300,120,20,0.6,label,VD Leibniz,,,Butterkeks
`;
