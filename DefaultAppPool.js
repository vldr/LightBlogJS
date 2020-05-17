// Load libraries.  
load("Web.js");
load("LightBlog.js");

// Initialize web framework.
Web.init(); 
Web.addRoute(["/", "/index"], "index.ejs");  

// Initialize database. 
LightBlog.initDb();