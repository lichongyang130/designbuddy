// Each concept has its own product purpose, units and choices; all figures are demo-only.
// Entries are aligned with the fifty existing story briefs (10 families × 5 concepts).
const raw=[
 // ceramics
 ['Morrow Cup Lab','Cup form','cups',['Morning cup','Tall mug','Wide tea cup'],'Plan a cup collection around handle, rim and scale.'],
 ['Basin Table Studio','Bowl profile','bowls',['Breakfast bowl','Serving basin','Shallow dish'],'Explore a bowl collection for preparation and shared meals.'],
 ['Stem & Form','Vessel silhouette','vases',['Bud vessel','Tall cylinder','Wide arrangement'],'Configure vessels around stems, balance and display.'],
 ['Hands at Work','Studio session','sessions',['Clay introduction','Form study','Maker residency'],'Plan a hands-on making session with a fictional studio.'],
 ['Gathered Table','Place setting','settings',['Daily setting','Sharing service','Gathering set'],'Build a tableware selection for a shared setting.'],
 // urban
 ['Street Commons','Street intervention','segments',['Seating study','Shaded edge','Shared crossing'],'Model a community-oriented street improvement workshop.'],
 ['Corner Works','Building approach','studies',['Entry review','Corner study','Facade workshop'],'Explore how a corner building meets its surrounding streets.'],
 ['Layered City','Research method','surveys',['Walking survey','Archive review','Community mapping'],'Plan a study of the layers within an existing neighbourhood.'],
 ['Block by Block','Walk format','walks',['Street walk','Access audit','Neighbourhood tour'],'Organize a fictional walk through a city block.'],
 ['Facade Notes','Lighting study','views',['Morning light','Afternoon shade','Evening view'],'Compare an architectural facade across different conditions.'],
 // bakery
 ['First Rise','Bake collection','batches',['Morning loaf','Breakfast rolls','Sharing selection'],'Plan a fictional morning bake for a small counter.'],
 ['Loaf Journal','Loaf format','loaves',['Country loaf','Soft tin loaf','Sharing boule'],'Explore a loaf lineup from dough through the finished counter.'],
 ['Pastry Counter','Pastry format','trays',['Butter layers','Cinnamon knots','Mixed pastries'],'Organize a sample pastry counter for a morning service.'],
 ['The Baker’s Bench','Workshop focus','sessions',['Dough basics','Shaping practice','Open kitchen'],'Plan a fictional learning session at the baker’s worktable.'],
 ['Corner Bakery','Service format','guests',['Counter visit','Coffee morning','Neighbourhood table'],'Imagine a community bakery visit and service flow.'],
 // travel
 ['Blue Hour Routes','Coast experience','travellers',['Sunrise walk','Blue hour visit','Full coast day'],'Plan an illustrative coastal visit around changing light.'],
 ['Harbour Daybook','Harbour outing','travellers',['Waterfront walk','Harbour tour','Day by the pier'],'Explore a fictional day around a working harbour.'],
 ['Island Passage','Crossing plan','travellers',['Morning crossing','Return passage','Island day'],'Compare example options for a fictional island day.'],
 ['Shoreline Steps','Walking route','walkers',['Short shore walk','Cliffside route','Long coastal path'],'Prepare a sample shoreline walk with flexible group size.'],
 ['Waterlight','Viewing session','visitors',['Morning reflection','Afternoon light','Evening horizon'],'Plan a fictional photographic session beside the water.'],
 // outdoors
 ['Understory','Trail length','walkers',['Woodland loop','Canopy walk','Forest day'],'Create an illustrative outing through a tree-lined path.'],
 ['Canopy Lens','Observation focus','observers',['Leaf patterns','Tree textures','Canopy light'],'Plan a fictional field photography session.'],
 ['Forest Mornings','Morning route','walkers',['Gentle loop','Quiet viewpoint','Guided morning'],'Build a sample morning outdoors around a comfortable pace.'],
 ['Bark & Branch','Field topic','participants',['Bark textures','Branch shapes','Light and leaves'],'Compare subjects for a fictional natural-texture study.'],
 ['Open Air Pause','Rest format','participants',['Short pause','Mindful walk','Group break'],'Plan an illustrative group pause outdoors.'],
 // tech
 ['Clarity OS','Workspace tier','teams',['Solo workspace','Team dashboard','Extended workspace'],'Explore a fictional workspace designed for clearer workflows.'],
 ['Platform Studio','System layer','instances',['Interface layer','Data pipeline','Operations layer'],'Model a sample platform plan for a fictional software team.'],
 ['Signal Review','Review format','reports',['Metric review','Trend session','Decision brief'],'Build an illustrative review around evidence and decisions.'],
 ['Orbit Launchpad','Launch activity','sessions',['Product walkthrough','Team preview','Launch briefing'],'Plan a fictional, people-centred product introduction.'],
 ['Plainline Design','Design review','reviews',['Content audit','Interface review','Accessibility pass'],'Organize a sample review for a clearer digital interface.'],
 // food
 ['Shared Table','Table format','guests',['Small table','Family sharing','Group dinner'],'Plan a fictional meal designed for a shared table.'],
 ['Seasonal Kitchen','Menu focus','guests',['Market vegetables','Seasonal plates','Tasting menu'],'Explore an illustrative seasonal menu without placing an order.'],
 ['Neighbour Lunch','Lunch service','guests',['Counter lunch','Table lunch','Group lunch'],'Compare sample lunch service formats for a neighbourhood venue.'],
 ['Kitchen to Table','Dining format','guests',['Kitchen tasting','Chef table','Shared supper'],'Plan a fictional journey from kitchen preparation to the table.'],
 ['Evening Gathering','Dinner setting','guests',['Intimate dinner','Shared table','Private gathering'],'Model an illustrative evening gathering with flexible guest count.'],
 // coffee
 ['First Cup','Coffee occasion','servings',['Morning cup','Two-cup break','Sharing pot'],'Plan a fictional first cup of the day.'],
 ['Counter Stories','Counter format','servings',['Walk-up coffee','Table service','Tasting flight'],'Explore an illustrative coffee counter service.'],
 ['Coffee & Conversation','Conversation setting','guests',['One-to-one','Small group','Community table'],'Build a sample gathering around coffee and conversation.'],
 ['Coffee Study','Visual focus','sessions',['Cup and light','Counter detail','Preparation study'],'Plan a fictional coffee product photography session.'],
 ['Everyday Café','Café service','visitors',['Morning visit','Afternoon coffee','Neighbour event'],'Model an example visit to a fictional neighbourhood café.'],
 // bicycle
 ['Everyday Cycle','Ride setup','bikes',['City frame','Commuter setup','Weekend setup'],'Configure an illustrative bicycle for everyday trips.'],
 ['Wheel Workshop','Workshop service','sessions',['Fit check','Frame review','Service session'],'Organize a fictional bicycle workshop visit.'],
 ['Ride Geometry','Frame focus','builds',['Compact frame','Balanced frame','Long-distance frame'],'Explore sample frame configurations without technical claims.'],
 ['Slow City Ride','Ride format','riders',['Neighbour loop','Park route','Town outing'],'Plan an illustrative city ride for a small group.'],
 ['Rider Fit Studio','Fit session','riders',['Initial fitting','Adjustment review','Follow-up session'],'Organize an example rider fit consultation.'],
 // radio
 ['Listening Room','Listening format','sessions',['Solo listening','Small gathering','Listening workshop'],'Plan a fictional session for a community listening room.'],
 ['Evening Air','Broadcast format','episodes',['Music hour','Evening interview','Late-night mix'],'Sketch a sample evening radio programme.'],
 ['Studio Notes','Production task','sessions',['Recording session','Edit review','Sound check'],'Organize a fictional production session in a radio studio.'],
 ['Independent Frequency','Programme type','episodes',['Artist feature','Local sound','Archive selection'],'Explore an illustrative independent audio programme.'],
 ['On Air Conversations','Conversation format','episodes',['One guest','Panel discussion','Community voices'],'Plan a sample conversation for an imaginary broadcast.']
]
export const ARTIFACT_PROFILES=raw.map(([brand,option,unit,labels,purpose],index)=>({brand,option,unit,purpose,choices:labels.map((label,i)=>[label,8+Math.floor(index/5)*3+i*(9+(index%5))]),base:20+Math.floor(index/5)*9+(index%5)*3}))
