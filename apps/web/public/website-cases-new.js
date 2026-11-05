// Independent fictional concepts; forms and transactions are local prototypes.
export const makeScreens = (s) => [
  ['Home','home',s.home,s.intro],
  [s.nav[0][0],'catalog',s.catalog,s.catalogLead],
  [s.categories[0],'catalog',s.categories[0],s.catalogLead],
  [s.categories[1],'catalog',s.categories[1],s.catalogLead],
  [s.collection,'catalog',s.collection,s.catalogLead],
  ...s.items.map(([name,subtitle])=>[name,'detail',name,subtitle+'. Explore this example and add it to your selection.']),
  [s.faq,'faq',s.faq,'Common questions about this interactive demonstration.'],
  [s.nav[1][0],'story',s.about,s.aboutLead],
  [s.process,'story',s.process,s.processLead],
  [s.gallery,'gallery',s.gallery,s.galleryLead],
  [s.people,'story',s.people,s.peopleLead],
  [s.values,'story',s.values,s.valuesLead],
  [s.nav[2][0],'gallery',s.stories,s.storiesLead],
  ...s.articles.map(([title,lead])=>[title,'story',title,lead]),
  [s.nav[3][0],'gallery',s.events,s.eventsLead],
  [s.bookings[0],'booking',s.bookings[0],'Choose a date and time to try the local demonstration.'],
  [s.bookings[1],'booking',s.bookings[1],'Choose a date and time to try the local demonstration.'],
  [s.calc,'calculator',s.calc,'Adjust the example assumptions to explore an illustrative estimate.'],
  [s.gift[0],'detail',s.gift[0],s.gift[1]+'. This is a fictional demonstration.'],
  [s.nav[4][0],'story',s.visit,s.visitLead],
  ['Your selection','cart','Your selection','Review the items you selected in this local demonstration.'],
  ['Review','checkout','Review your selection','Review your choices before confirming the demonstration.'],
  ['Confirmation','confirmation',s.thanks,'This is a prototype. No payment, reservation or order is made.'],
]
const concepts = [
 {
  id:'campus-site',name:'OPEN / LEARNING',domain:'openlearning.example',style:'campus',shell:'campus',
  theme:['#E8E2F4','#28223D','#674D9B','#D3C6E6','#746C86','#BDB0D3','#4D4561'],
  intro:'Make space for a different way to learn.',description:'An independent learning institute, with an academic directory layout, lilac palette, course discovery and demo registration.',
  nav:[['Courses',1],['Institute',12],['Perspectives',17],['Attend',21],['Visit',26]],categories:['Creative practice','Thinking tools'],
  gift:['Learning pass','A sample pass for a curious friend',50,'11'],
  tool:{label:'Number of learners',rateLabel:'Assumed fee per learner ($)',quantity:8,rate:30,disclaimer:'Illustrative course estimate only. No enrollment or payment is made.'},
  items:[['Visual thinking','Creative practice · introductory',30,'02'],['Ways of seeing','Creative practice · seminar',45,'03'],['Writing together','Thinking tools · workshop',35,'04'],['Design for change','Thinking tools · studio',55,'05'],['The research lab','Thinking tools · seminar',40,'08'],['Ideas in practice','Creative practice · studio',60,'09']],
  home:'A place for open minds.',catalog:'Learn something new',catalogLead:'Browse fictional courses and discover a new perspective.',collection:'All programmes',faq:'Course questions',about:'Learning is a shared practice',aboutLead:'An imaginary institute for curiosity, collaboration and lifelong learning.',process:'How we learn',processLead:'Small groups, thoughtful questions and time to experiment.',gallery:'Inside the institute',galleryLead:'Explore the classrooms, resources and people behind the idea.',people:'Our educators',peopleLead:'Meet the imagined facilitators who make space for discovery.',values:'Learning for everyone',valuesLead:'A welcoming environment starts with generosity and openness.',stories:'Perspectives on learning',storiesLead:'Ideas, conversations and notes from the classroom.',
  articles:[['The power of a good question','How curiosity can change the direction of a conversation.'],['Make room for experiments','A look at practice, mistakes and the joy of trying.'],['Learning in community','What happens when people share what they know.']],
  events:'Learn together',eventsLead:'Explore example sessions or estimate a group learning experience.',bookings:['Open classroom','Meet an educator'],calc:'Group learning estimate',visit:'Visit the institute',visitLead:'A fictional place for learning in the heart of the neighbourhood.',thanks:'Keep asking questions.'
 },
 {
  id:'field-site',name:'TIDEWATCH',domain:'tidewatch.example',style:'field',shell:'field',
  theme:['#D9E8E4','#193E3B','#287B70','#B8D2C9','#668C84','#AEC9C1','#365A53'],
  intro:'Observing the coast, one tide at a time.',description:'A coastal field station concept with a permanent photographic field panel, sea-glass palette, research directory and visit demo.',
  nav:[['Explore',1],['Station',12],['Field notes',17],['Join us',21],['Contact',26]],categories:['Field studies','Coastal learning'],
  gift:['Supporter pass','A sample supporter pass',50,'11'],
  tool:{label:'Number of participants',rateLabel:'Assumed cost per participant ($)',quantity:6,rate:20,disclaimer:'Illustrative field visit estimate only. No reservation or donation is made.'},
  items:[['Shoreline survey','Field studies · sample',20,'02'],['Seabird watch','Field studies · sample',25,'03'],['Tidepool study','Coastal learning · sample',18,'04'],['Coastal transect','Field studies · sample',30,'05'],['Water observations','Coastal learning · sample',22,'08'],['Field notebook','Coastal learning · sample',16,'09']],
  home:'The coast is always changing.',catalog:'Explore the fieldwork',catalogLead:'Discover fictional studies, observations and ways to learn by the sea.',collection:'All field programmes',faq:'Fieldwork questions',about:'A closer look at the coast',aboutLead:'A fictional field station for noticing the changes along our shore.',process:'The observation cycle',processLead:'Patient looking and careful notes help reveal the rhythms of a place.',gallery:'Life at the station',galleryLead:'A glimpse of the coast, the station and the work in the field.',people:'The field team',peopleLead:'Meet the imagined people looking after this coastal project.',values:'Care for the shore',valuesLead:'Thoughtful observation begins with respect for the places we visit.',stories:'Notes from the waterline',storiesLead:'Stories and observations inspired by the coast.',
  articles:[['A morning with the seabirds','A quiet moment watching the movement above the cliffs.'],['Reading the tide','How the changing water reveals a different landscape.'],['A field notebook','The small details worth recording on a day by the sea.']],
  events:'Step into the field',eventsLead:'Explore sample visits or estimate the cost for a group.',bookings:['Station visit','Guided shoreline walk'],calc:'Field visit estimate',visit:'Get in touch',visitLead:'Start a conversation about the coast and the people who observe it.',thanks:'Thank you for looking closer.'
 },
 {
  id:'bazaar-site',name:'MARKET / LOOP',domain:'marketloop.example',style:'bazaar',shell:'bazaar',
  theme:['#F9D7A7','#533022','#CF5534','#F4BE78','#92674D','#DDA77A','#704B36'],
  intro:'Good things happen around the market.',description:'A neighbourhood market concept with a stacked wayfinding header, terracotta-orange palette, stall directory and demo market visits.',
  nav:[['Stalls',1],['The market',12],['Stories',17],['Visit together',21],['Find us',26]],categories:['Fresh produce','Market makers'],
  gift:['Market gift','A sample gift for a market lover',50,'11'],
  tool:{label:'Number of guests',rateLabel:'Assumed market tour cost per guest ($)',quantity:10,rate:15,disclaimer:'Illustrative market tour estimate only. No booking or payment is made.'},
  items:[['The fruit stand','Fresh produce · sample',12,'02'],['Green grocer','Fresh produce · sample',14,'03'],['Spice corner','Market makers · sample',10,'04'],['Bread stall','Market makers · sample',9,'05'],['Seasonal basket','Fresh produce · sample',24,'08'],['Kitchen pantry','Market makers · sample',18,'09']],
  home:'Meet you at the market.',catalog:'Find your favourite stall',catalogLead:'Explore a fictional collection of neighbourhood food and makers.',collection:'The whole market',faq:'Market questions',about:'A market made by neighbours',aboutLead:'An imagined gathering place for local food, stories and community.',process:'From farm to stall',processLead:'A closer look at the people and ideas that bring a market to life.',gallery:'Around the market',galleryLead:'Walk the aisles, meet the makers and discover the colours of the day.',people:'Meet the stallholders',peopleLead:'The fictional makers and neighbours who make this market feel alive.',values:'A place for everyone',valuesLead:'The best markets make room for a whole neighbourhood.',stories:'Stories from the stalls',storiesLead:'Little moments and good conversations from around the market.',
  articles:[['An early market morning','The first deliveries and the people setting up for the day.'],['A basket for the season','Ideas for enjoying what is fresh and colourful.'],['A recipe for gathering','Food and conversation make a good afternoon together.']],
  events:'Make a day of it',eventsLead:'Explore sample market visits or estimate a group tour.',bookings:['Market morning tour','Meet the makers'],calc:'Group visit estimate',visit:'Find the market',visitLead:'A fictional market at the centre of a lively neighbourhood.',thanks:'See you around the market.'
 }
]
export const NEW_SITE_DEFINITIONS = concepts.map(s=>({...s,screens:makeScreens(s)}))
