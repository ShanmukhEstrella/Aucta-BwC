import { supabase } from "./supabaseClient";

/* Amounts are in ₹ LAKH. 10000 lakh = ₹100 crore. */
export const DEFAULT_PURSE = 10000;
export const MAX_SQUAD = 25;
export const MIN_SQUAD = 18;
export const MAX_OVERSEAS = 8;

export function fmtCr(lakh) {
  if (lakh == null) return "—";
  if (lakh >= 100) {
    const cr = lakh / 100;
    return "₹" + (Number.isInteger(cr) ? cr : cr.toFixed(2)) + " cr";
  }
  return "₹" + lakh + " L";
}

export const FRANCHISES = [
  { short: "CSK", name: "Chennai Super Kings", color: "#F9CD05", ink: "#16130D" },
  { short: "MI", name: "Mumbai Indians", color: "#045093", ink: "#ffffff" },
  { short: "RCB", name: "Royal Challengers Bengaluru", color: "#D41B2E", ink: "#ffffff" },
  { short: "KKR", name: "Kolkata Knight Riders", color: "#3A225D", ink: "#F9CD05" },
  { short: "SRH", name: "Sunrisers Hyderabad", color: "#F7641F", ink: "#16130D" },
  { short: "DC", name: "Delhi Capitals", color: "#17449B", ink: "#ffffff" },
  { short: "RR", name: "Rajasthan Royals", color: "#E0218A", ink: "#ffffff" },
  { short: "PBKS", name: "Punjab Kings", color: "#D11D2C", ink: "#ffffff" },
  { short: "GT", name: "Gujarat Titans", color: "#1B2133", ink: "#C9A24B" },
  { short: "LSG", name: "Lucknow Super Giants", color: "#0157A5", ink: "#F9CD05" },
];
export const franchiseColor = (name) => (FRANCHISES.find((f) => f.name === name) || {}).color || "#C2A14E";

export const TIER_ORDER = ["Tier-1", "Tier-2", "Tier-3"];
export const CATEGORY_ORDER = ["Batters", "Bowlers", "All-rounders", "Wicket-keepers"];
export const SET_ORDER = [
  "Tier-1 Batters", "Tier-2 Bowlers", "Tier-1 All-rounders", "Tier-3 Wicket-keepers",
  "Tier-2 Batters", "Tier-1 Bowlers", "Tier-3 All-rounders", "Tier-2 Wicket-keepers",
  "Tier-3 Batters", "Tier-2 All-rounders", "Tier-3 Bowlers", "Tier-1 Wicket-keepers",
];

const roleCategory = (role) => role === "Batter" ? "Batters" : role === "Bowler" ? "Bowlers" : role === "WK-Batter" ? "Wicket-keepers" : "All-rounders";
const baseFor = (tier, role) => ({ "Tier-1": 200, "Tier-2": 100, "Tier-3": 50 }[tier] + (role === "All-rounder" ? 25 : role === "WK-Batter" ? 10 : 0));
const line = (tier, role, country, names) => names.split(",").map((name) => {
  const n = name.trim();
  const category = roleCategory(role);
  return {
    name: n,
    role,
    country,
    overseas: country !== "India",
    base: baseFor(tier, role),
    tier,
    category,
    set: `${tier} ${category}`,
    stats: { m: 0, runs: 0, wkts: 0, avg: 0, sr: 0 },
  };
});

export const BUILTIN_ROSTER = [
  ...line("Tier-1", "Batter", "India", "Virat Kohli, Rohit Sharma, Shubman Gill, Suryakumar Yadav, Yashasvi Jaiswal, Ruturaj Gaikwad"),
  ...line("Tier-1", "WK-Batter", "India", "Rishabh Pant, KL Rahul, Sanju Samson"),
  ...line("Tier-1", "All-rounder", "India", "Hardik Pandya, Ravindra Jadeja, Axar Patel"),
  ...line("Tier-1", "Bowler", "India", "Jasprit Bumrah, Mohammed Shami, Mohammed Siraj, Kuldeep Yadav, Arshdeep Singh"),
  ...line("Tier-2", "Batter", "India", "Shreyas Iyer, Tilak Varma, Rinku Singh, Sai Sudharsan, Abhishek Sharma, Rajat Patidar, Prithvi Shaw"),
  ...line("Tier-2", "WK-Batter", "India", "Ishan Kishan, Dhruv Jurel, Jitesh Sharma"),
  ...line("Tier-2", "All-rounder", "India", "Washington Sundar, Shivam Dube, Nitish Kumar Reddy, Shardul Thakur"),
  ...line("Tier-2", "Bowler", "India", "Ravi Bishnoi, Yuzvendra Chahal, Varun Chakravarthy, Mukesh Kumar, Avesh Khan, Prasidh Krishna"),
  ...line("Tier-3", "Batter", "India", "Devdutt Padikkal, Sarfaraz Khan, Rahul Tripathi, Mayank Agarwal, Deepak Hooda, Karun Nair"),
  ...line("Tier-3", "WK-Batter", "India", "KS Bharat, Prabhsimran Singh, Anuj Rawat"),
  ...line("Tier-3", "All-rounder", "India", "Krunal Pandya, Shahbaz Ahmed, Vijay Shankar, Riyan Parag"),
  ...line("Tier-3", "Bowler", "India", "Harshit Rana, Mayank Yadav, T Natarajan, Deepak Chahar, Khaleel Ahmed, Umran Malik"),

  ...line("Tier-1", "Batter", "Australia", "Travis Head, Steve Smith, David Warner, Marnus Labuschagne, Mitchell Marsh"),
  ...line("Tier-1", "WK-Batter", "Australia", "Josh Inglis, Alex Carey"),
  ...line("Tier-1", "All-rounder", "Australia", "Glenn Maxwell, Cameron Green, Marcus Stoinis"),
  ...line("Tier-1", "Bowler", "Australia", "Pat Cummins, Mitchell Starc, Josh Hazlewood, Adam Zampa"),
  ...line("Tier-2", "Batter", "Australia", "Jake Fraser-McGurk, Tim David, Matt Short, Aaron Hardie"),
  ...line("Tier-2", "WK-Batter", "Australia", "Matthew Wade, Josh Philippe"),
  ...line("Tier-2", "All-rounder", "Australia", "Beau Webster, Ashton Agar, Sean Abbott"),
  ...line("Tier-2", "Bowler", "Australia", "Nathan Ellis, Spencer Johnson, Jhye Richardson, Lance Morris, Riley Meredith"),
  ...line("Tier-3", "Batter", "Australia", "Ben McDermott, Daniel Hughes, Caleb Jewell"),
  ...line("Tier-3", "WK-Batter", "Australia", "Sam Harper"),
  ...line("Tier-3", "All-rounder", "Australia", "Daniel Sams, Will Sutherland"),
  ...line("Tier-3", "Bowler", "Australia", "Jason Behrendorff, Tanveer Sangha, Todd Murphy"),

  ...line("Tier-1", "Batter", "England", "Jos Buttler, Phil Salt, Joe Root, Harry Brook, Ben Duckett"),
  ...line("Tier-1", "WK-Batter", "England", "Jonny Bairstow, Jamie Smith"),
  ...line("Tier-1", "All-rounder", "England", "Ben Stokes, Liam Livingstone, Sam Curran, Moeen Ali"),
  ...line("Tier-1", "Bowler", "England", "Jofra Archer, Mark Wood, Adil Rashid, Reece Topley"),
  ...line("Tier-2", "Batter", "England", "Dawid Malan, Will Jacks, Zak Crawley, Ollie Pope"),
  ...line("Tier-2", "WK-Batter", "England", "Sam Billings, Phil Mustard"),
  ...line("Tier-2", "All-rounder", "England", "Chris Woakes, Tom Curran, Brydon Carse"),
  ...line("Tier-2", "Bowler", "England", "Gus Atkinson, Saqib Mahmood, Matthew Potts, Luke Wood"),
  ...line("Tier-3", "Batter", "England", "James Vince, Alex Hales, Dan Lawrence"),
  ...line("Tier-3", "WK-Batter", "England", "Jordan Cox"),
  ...line("Tier-3", "All-rounder", "England", "Lewis Gregory, Jamie Overton"),
  ...line("Tier-3", "Bowler", "England", "Tymal Mills, Mason Crane, Olly Stone"),

  ...line("Tier-1", "Batter", "New Zealand", "Kane Williamson, Devon Conway, Daryl Mitchell, Finn Allen"),
  ...line("Tier-1", "WK-Batter", "New Zealand", "Tom Latham, Tim Seifert"),
  ...line("Tier-1", "All-rounder", "New Zealand", "Mitchell Santner, Rachin Ravindra, Michael Bracewell"),
  ...line("Tier-1", "Bowler", "New Zealand", "Trent Boult, Lockie Ferguson, Matt Henry, Tim Southee"),
  ...line("Tier-2", "Batter", "New Zealand", "Glenn Phillips, Mark Chapman, Will Young"),
  ...line("Tier-2", "WK-Batter", "New Zealand", "Tom Blundell"),
  ...line("Tier-2", "All-rounder", "New Zealand", "James Neesham, Kyle Jamieson"),
  ...line("Tier-2", "Bowler", "New Zealand", "Ish Sodhi, Ajaz Patel, Ben Sears"),
  ...line("Tier-3", "Batter", "New Zealand", "Henry Nicholls, Chad Bowes"),
  ...line("Tier-3", "All-rounder", "New Zealand", "Nathan Smith, Cole McConchie"),
  ...line("Tier-3", "Bowler", "New Zealand", "Blair Tickner, Jacob Duffy, William ORourke"),

  ...line("Tier-1", "Batter", "South Africa", "Aiden Markram, David Miller, Rassie van der Dussen, Tristan Stubbs"),
  ...line("Tier-1", "WK-Batter", "South Africa", "Heinrich Klaasen, Quinton de Kock"),
  ...line("Tier-1", "All-rounder", "South Africa", "Marco Jansen, Wiaan Mulder"),
  ...line("Tier-1", "Bowler", "South Africa", "Kagiso Rabada, Anrich Nortje, Keshav Maharaj, Tabraiz Shamsi"),
  ...line("Tier-2", "Batter", "South Africa", "Reeza Hendricks, Ryan Rickelton, Temba Bavuma, Tony de Zorzi"),
  ...line("Tier-2", "WK-Batter", "South Africa", "Kyle Verreynne"),
  ...line("Tier-2", "All-rounder", "South Africa", "Andile Phehlukwayo, Donovan Ferreira"),
  ...line("Tier-2", "Bowler", "South Africa", "Lungi Ngidi, Gerald Coetzee, Nandre Burger, Ottneil Baartman"),
  ...line("Tier-3", "Batter", "South Africa", "Matthew Breetzke, Dewald Brevis"),
  ...line("Tier-3", "All-rounder", "South Africa", "George Linde, Bjorn Fortuin"),
  ...line("Tier-3", "Bowler", "South Africa", "Lizaad Williams, Beuran Hendricks"),

  ...line("Tier-1", "Batter", "Pakistan", "Babar Azam, Mohammad Rizwan, Fakhar Zaman, Saim Ayub"),
  ...line("Tier-1", "WK-Batter", "Pakistan", "Azam Khan"),
  ...line("Tier-1", "All-rounder", "Pakistan", "Shadab Khan, Iftikhar Ahmed, Imad Wasim"),
  ...line("Tier-1", "Bowler", "Pakistan", "Shaheen Afridi, Haris Rauf, Naseem Shah, Mohammad Amir"),
  ...line("Tier-2", "Batter", "Pakistan", "Abdullah Shafique, Imam-ul-Haq, Shan Masood, Saud Shakeel"),
  ...line("Tier-2", "WK-Batter", "Pakistan", "Mohammad Haris, Haseebullah Khan"),
  ...line("Tier-2", "All-rounder", "Pakistan", "Agha Salman, Mohammad Nawaz"),
  ...line("Tier-2", "Bowler", "Pakistan", "Hasan Ali, Abrar Ahmed, Usama Mir, Abbas Afridi"),
  ...line("Tier-3", "Batter", "Pakistan", "Haider Ali, Khushdil Shah"),
  ...line("Tier-3", "All-rounder", "Pakistan", "Faheem Ashraf, Aamer Jamal"),
  ...line("Tier-3", "Bowler", "Pakistan", "Zaman Khan, Mohammad Wasim Jr"),

  ...line("Tier-1", "Batter", "West Indies", "Nicholas Pooran, Shimron Hetmyer, Rovman Powell, Brandon King"),
  ...line("Tier-1", "WK-Batter", "West Indies", "Shai Hope, Johnson Charles"),
  ...line("Tier-1", "All-rounder", "West Indies", "Andre Russell, Romario Shepherd, Jason Holder, Sherfane Rutherford"),
  ...line("Tier-1", "Bowler", "West Indies", "Alzarri Joseph, Akeal Hosein, Gudakesh Motie"),
  ...line("Tier-2", "Batter", "West Indies", "Evin Lewis, Kyle Mayers, Keacy Carty"),
  ...line("Tier-2", "WK-Batter", "West Indies", "Devon Thomas"),
  ...line("Tier-2", "All-rounder", "West Indies", "Roston Chase, Odean Smith, Keemo Paul"),
  ...line("Tier-2", "Bowler", "West Indies", "Obed McCoy, Jayden Seales, Shamar Joseph"),
  ...line("Tier-3", "Batter", "West Indies", "Alick Athanaze, Tagenarine Chanderpaul"),
  ...line("Tier-3", "All-rounder", "West Indies", "Fabian Allen, Raymon Reifer"),
  ...line("Tier-3", "Bowler", "West Indies", "Hayden Walsh Jr, Sheldon Cottrell"),

  ...line("Tier-1", "Batter", "Sri Lanka", "Pathum Nissanka, Kusal Mendis, Charith Asalanka"),
  ...line("Tier-1", "WK-Batter", "Sri Lanka", "Dinesh Chandimal"),
  ...line("Tier-1", "All-rounder", "Sri Lanka", "Wanindu Hasaranga, Dasun Shanaka, Dhananjaya de Silva"),
  ...line("Tier-1", "Bowler", "Sri Lanka", "Maheesh Theekshana, Matheesha Pathirana, Dilshan Madushanka"),
  ...line("Tier-2", "Batter", "Sri Lanka", "Avishka Fernando, Sadeera Samarawickrama, Kamindu Mendis"),
  ...line("Tier-2", "WK-Batter", "Sri Lanka", "Niroshan Dickwella"),
  ...line("Tier-2", "All-rounder", "Sri Lanka", "Dunith Wellalage, Chamika Karunaratne"),
  ...line("Tier-2", "Bowler", "Sri Lanka", "Dushmantha Chameera, Lahiru Kumara, Kasun Rajitha"),
  ...line("Tier-3", "Batter", "Sri Lanka", "Bhanuka Rajapaksa, Angelo Mathews"),
  ...line("Tier-3", "Bowler", "Sri Lanka", "Akila Dananjaya, Pramod Madushan"),

  ...line("Tier-1", "Batter", "Afghanistan", "Rahmanullah Gurbaz, Ibrahim Zadran, Najibullah Zadran"),
  ...line("Tier-1", "WK-Batter", "Afghanistan", "Ikram Alikhil"),
  ...line("Tier-1", "All-rounder", "Afghanistan", "Mohammad Nabi, Azmatullah Omarzai, Gulbadin Naib"),
  ...line("Tier-1", "Bowler", "Afghanistan", "Rashid Khan, Mujeeb Ur Rahman, Fazalhaq Farooqi, Noor Ahmad"),
  ...line("Tier-2", "Batter", "Afghanistan", "Hashmatullah Shahidi, Hazratullah Zazai, Rahmat Shah"),
  ...line("Tier-2", "All-rounder", "Afghanistan", "Karim Janat, Nangeyalia Kharote"),
  ...line("Tier-2", "Bowler", "Afghanistan", "Naveen-ul-Haq, Qais Ahmad, Fareed Ahmad"),
  ...line("Tier-3", "Batter", "Afghanistan", "Sediqullah Atal, Darwish Rasooli"),
  ...line("Tier-3", "Bowler", "Afghanistan", "Yamin Ahmadzai, Sharafuddin Ashraf"),

  ...line("Tier-1", "Batter", "Bangladesh", "Litton Das, Towhid Hridoy, Najmul Hossain Shanto"),
  ...line("Tier-1", "WK-Batter", "Bangladesh", "Mushfiqur Rahim"),
  ...line("Tier-1", "All-rounder", "Bangladesh", "Shakib Al Hasan, Mehidy Hasan Miraz, Mahmudullah"),
  ...line("Tier-1", "Bowler", "Bangladesh", "Taskin Ahmed, Mustafizur Rahman, Shoriful Islam"),
  ...line("Tier-2", "Batter", "Bangladesh", "Tanzid Hasan, Soumya Sarkar, Anamul Haque"),
  ...line("Tier-2", "WK-Batter", "Bangladesh", "Jaker Ali"),
  ...line("Tier-2", "All-rounder", "Bangladesh", "Mahedi Hasan, Afif Hossain"),
  ...line("Tier-2", "Bowler", "Bangladesh", "Hasan Mahmud, Rishad Hossain, Tanvir Islam"),

  ...line("Tier-2", "Batter", "Ireland", "Paul Stirling, Harry Tector, Andrew Balbirnie"),
  ...line("Tier-2", "All-rounder", "Ireland", "Curtis Campher, George Dockrell, Gareth Delany"),
  ...line("Tier-2", "Bowler", "Ireland", "Josh Little, Mark Adair, Barry McCarthy"),
  ...line("Tier-2", "Batter", "Zimbabwe", "Sikandar Raza, Craig Ervine, Sean Williams"),
  ...line("Tier-2", "WK-Batter", "Zimbabwe", "Clive Madande"),
  ...line("Tier-2", "All-rounder", "Zimbabwe", "Ryan Burl, Wesley Madhevere"),
  ...line("Tier-2", "Bowler", "Zimbabwe", "Blessing Muzarabani, Richard Ngarava, Tendai Chatara"),
  ...line("Tier-2", "Batter", "Netherlands", "Max ODowd, Vikramjit Singh, Bas de Leede"),
  ...line("Tier-2", "All-rounder", "Netherlands", "Logan van Beek, Roelof van der Merwe"),
  ...line("Tier-2", "Bowler", "Netherlands", "Paul van Meekeren, Aryan Dutt, Fred Klaassen"),
  ...line("Tier-2", "Batter", "Scotland", "George Munsey, Richie Berrington, Brandon McMullen"),
  ...line("Tier-2", "All-rounder", "Scotland", "Michael Leask, Chris Greaves"),
  ...line("Tier-2", "Bowler", "Scotland", "Mark Watt, Safyaan Sharif, Brad Wheal"),
  ...line("Tier-2", "Batter", "USA", "Aaron Jones, Steven Taylor, Monank Patel"),
  ...line("Tier-2", "All-rounder", "USA", "Corey Anderson, Harmeet Singh"),
  ...line("Tier-2", "Bowler", "USA", "Saurabh Netravalkar, Ali Khan, Nosthush Kenjige"),
];

export function orderBySet(lots) {
  const bySet = new Map();
  for (const lot of lots) {
    const key = lot.set || "Other";
    bySet.set(key, [...(bySet.get(key) || []), lot]);
  }
  for (const bucket of bySet.values()) bucket.sort((a, b) => a.name.localeCompare(b.name));

  const allSets = [
    ...SET_ORDER,
    ...[...bySet.keys()].filter((set) => !SET_ORDER.includes(set)).sort(),
  ];

  const ordered = [];
  const chunkSize = 10;
  let moved = true;
  while (moved) {
    moved = false;
    for (const set of allSets) {
      const bucket = bySet.get(set) || [];
      const chunk = bucket.splice(0, chunkSize);
      if (chunk.length) {
        ordered.push(...chunk);
        moved = true;
      }
    }
  }

  return ordered;
}

export const nextRoomBid = (lot) => {
  if (!lot) return 0;
  const inc = (c) => (c == null ? 0 : c < 100 ? 10 : c < 200 ? 20 : 25);
  return lot.cur_bid == null ? lot.base_price : lot.cur_bid + inc(lot.cur_bid);
};

/* RPCs */
export const createRoom = (name, purse, team, short, lots) =>
  supabase.rpc("create_play_room", { p_name: name, p_purse: purse, p_team: team, p_short: short, p_lots: lots });
export const joinRoom = (code, team, short) =>
  supabase.rpc("join_play_room", { p_code: code, p_team: team, p_short: short });
export const startRoom = (roomId) => supabase.rpc("start_play_room", { p_room: roomId });
export const bidRoom = (roomId, lotId, amount) => supabase.rpc("place_room_bid", { p_room: roomId, p_lot: lotId, p_amount: amount });
export const skipRoomLot = (roomId, lotId) => supabase.rpc("skip_room_lot", { p_room: roomId, p_lot: lotId });
export const advanceRoom = (roomId) => supabase.rpc("advance_play", { p_room: roomId });
export const requestEndRoom = (roomId) => supabase.rpc("request_end_play_room", { p_room: roomId });
export const agreeEndRoom = (roomId) => supabase.rpc("agree_end_play_room", { p_room: roomId });

export async function fetchRoomPreview(code) {
  const clean = (code || "").trim().toUpperCase();
  if (!clean) return { room: null, members: [] };
  const { data: room, error } = await supabase.from("game_rooms").select("id, code, name, status").eq("code", clean).maybeSingle();
  if (error || !room) return { room: null, members: [], error };
  const { data: members } = await supabase.from("room_members").select("team_short, team_name, display_name, user_email").eq("room_id", room.id);
  return { room, members: members || [] };
}

export async function fetchRoom(roomId) {
  const [room, members, lots] = await Promise.all([
    supabase.from("game_rooms").select("*").eq("id", roomId).single(),
    supabase.from("room_members").select("*").eq("room_id", roomId),
    supabase.from("room_lots").select("*").eq("room_id", roomId).order("pool_order"),
  ]);
  return { room: room.data, members: members.data || [], lots: lots.data || [] };
}
