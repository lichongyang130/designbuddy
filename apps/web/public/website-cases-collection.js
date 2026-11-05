import { makeScreens } from './website-cases-new.js'
// Fictional interactive concepts. All actions are local demonstration only.
const concepts = [
 {
  id:'archive-site',name:'THE / INDEX',domain:'theindex.example',style:'archive',shell:'archive',
  theme:['#E9E5D5','#343C33','#65744F','#DCDCC6','#7C8573','#C5CBB8','#525F4D'],
  intro:'A living record of the things we make.',description:'An independent archive with a card catalogue frame, muted sage-ivory background, collection directory and local research appointment demo.',
  nav:[['Collections',1],['Archive',12],['Stories',17],['Research',21],['Visit',26]],categories:['Objects','Documents'],
  gift:['Research pass','A sample archive access pass',50,'11'],
  tool:{label:'Number of researchers',rateLabel:'Assumed visit cost per person ($)',quantity:4,rate:15,disclaimer:'Illustrative research visit estimate only. No appointment or payment is made.'},
  items:[['Material library','Objects · sample',15,'02'],['The object study','Objects · sample',20,'03'],['Working drawings','Documents · sample',12,'04'],['Photographic records','Documents · sample',18,'05'],['Making notes','Documents · sample',14,'08'],['Conservation study','Objects · sample',25,'09']],
  home:'Every object has a story.',catalog:'Explore the collection',catalogLead:'Discover fictional objects, documents and records from the archive.',collection:'The full catalogue',faq:'Archive questions',about:'A place to remember and discover',aboutLead:'An imagined archive preserving the traces of how things are made.',process:'How we care for a collection',processLead:'Careful documentation makes room for new questions and discoveries.',gallery:'Behind the catalogue',galleryLead:'Explore the shelves, workspaces and details of the archive.',people:'Meet the archivists',peopleLead:'The fictional people looking after this collection and its stories.',values:'Keeping things accessible',valuesLead:'An archive is most useful when it invites people to look closer.',stories:'Notes from the archive',storiesLead:'Stories about objects, records and the people who care for them.',
  articles:[['An object in focus','A closer look at the details that tell a bigger story.'],['The work of keeping','What care and observation can reveal over time.'],['Opening the collection','How a record can become the start of a conversation.']],
  events:'Make time for research',eventsLead:'Explore sample visits and estimate a group research session.',bookings:['Archive introduction','Research appointment'],calc:'Research visit estimate',visit:'Find the archive',visitLead:'Start a conversation about objects, records and shared knowledge.',thanks:'Thank you for exploring.'
 },
 {
  id:'maker-site',name:'SLOW / HANDS',domain:'slowhands.example',style:'maker',shell:'maker',
  theme:['#E8D5B2','#3B3024','#985B35','#D7BB92','#88765F','#C7A982','#66533E'],
  intro:'Good things take the time they take.',description:'A craft workshop concept with a workbench-inspired frame, parchment background, makers directory and local workshop booking.',
  nav:[['Workshops',1],['The workshop',12],['Journal',17],['Join us',21],['Visit',26]],categories:['Hand skills','Studio sessions'],
  gift:['Workshop gift','A sample gift for a maker',50,'11'],
  tool:{label:'Number of makers',rateLabel:'Assumed workshop cost per person ($)',quantity:6,rate:35,disclaimer:'Illustrative workshop estimate only. No booking or payment is made.'},
  items:[['Woodworking basics','Hand skills · sample',35,'02'],['The useful object','Hand skills · sample',45,'03'],['Tools and technique','Hand skills · sample',30,'04'],['Open studio','Studio sessions · sample',25,'05'],['A day at the bench','Studio sessions · sample',55,'08'],['Making together','Studio sessions · sample',40,'09']],
  home:'Make something that lasts.',catalog:'Find your next workshop',catalogLead:'Explore fictional workshops for curious hands and thoughtful making.',collection:'All workshops',faq:'Workshop questions',about:'A workshop with an open door',aboutLead:'An imagined place for learning by doing and making with care.',process:'From material to object',processLead:'Simple tools and patient hands can turn an idea into something useful.',gallery:'Inside the workshop',galleryLead:'Take a closer look at the tools, materials and work in progress.',people:'Meet the makers',peopleLead:'The fictional craftspeople sharing their skills and experience.',values:'Make less, make better',valuesLead:'A slower approach values useful things and the people who make them.',stories:'Notes from the bench',storiesLead:'Stories, materials and everyday rituals from the workshop.',
  articles:[['A favourite hand tool','Why the tools we reach for become part of our practice.'],['Learning by making','The small discoveries that come from working with our hands.'],['The beauty of repair','A considered way to give a useful object more life.']],
  events:'Come make with us',eventsLead:'Explore sample sessions or estimate a group workshop.',bookings:['Introduction to the bench','Open studio visit'],calc:'Workshop estimate',visit:'Visit the workshop',visitLead:'A fictional workshop for making, learning and good conversation.',thanks:'Keep making.'
 },
 {
  id:'urban-site',name:'COOL / CITY',domain:'coolcity.example',style:'urban',shell:'urban',
  theme:['#F4D8A8','#302F39','#B44F31','#EAC08B','#8D7567','#D9B28F','#5F514B'],
  intro:'Better streets for warmer days.',description:'An urban climate project with a map-key inspired frame, sand background, project catalogue and community workshop demo.',
  nav:[['Projects',1],['Approach',12],['Field notes',17],['Get involved',21],['Contact',26]],categories:['Streets','Community'],
  gift:['Community session','A sample neighbourhood planning session',50,'11'],
  tool:{label:'Number of participants',rateLabel:'Assumed session cost per person ($)',quantity:15,rate:10,disclaimer:'Illustrative community session estimate only. No booking or payment is made.'},
  items:[['A shaded street','Streets · sample',20,'02'],['Cooler crossings','Streets · sample',25,'03'],['The neighbourhood walk','Community · sample',15,'04'],['Places to pause','Streets · sample',18,'05'],['Mapping together','Community · sample',22,'08'],['Community workshop','Community · sample',30,'09']],
  home:'Make room for cooler days.',catalog:'Explore the projects',catalogLead:'Discover fictional ideas for streets and neighbourhoods in a warmer city.',collection:'All projects',faq:'Project questions',about:'A more comfortable city for all',aboutLead:'An imagined project exploring practical ideas for warmer urban days.',process:'From observation to action',processLead:'Start by listening, looking and learning from the people who use a place.',gallery:'On the street',galleryLead:'Explore streets, spaces and everyday moments across the neighbourhood.',people:'Our collaborators',peopleLead:'The fictional neighbours and designers shaping ideas together.',values:'Care at street level',valuesLead:'Better places begin with the people who live and move through them.',stories:'Notes from the city',storiesLead:'Stories and ideas about everyday life in a changing climate.',
  articles:[['A walk in the shade','Why small moments of comfort matter on a warm day.'],['Listening to a street','What can be learned by paying attention to a familiar route.'],['Making a place to pause','A look at the spaces that invite people to slow down.']],
  events:'Get involved locally',eventsLead:'Explore sample neighbourhood sessions and estimate a group activity.',bookings:['Neighbourhood walk','Community design session'],calc:'Session estimate',visit:'Start a conversation',visitLead:'Share an idea for a more comfortable neighbourhood.',thanks:'Thanks for imagining with us.'
 }
]
export const COLLECTION_SITE_DEFINITIONS = concepts.map(s=>({...s,screens:makeScreens(s)}))
