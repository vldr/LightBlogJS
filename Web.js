load("URI.js");
load("EJS.js");
load("Pako.js");

var Web = {}; 

// A prefixed tag for our logs.
Web.LOG_TAG = "[WEB]";

// A table for routing to different pages.
Web.routeTable = {};

// A table containing all cached webpages.
Web.cacheTable = {}; 

// A callback that can be set for users of the framework.
Web.directoryUpdateCallback = null;
 
/**
 * Handles any pre begin requests, used for deliverying cache.
 */
Web.handlePreBeginRequest = function(response, request)
{
    // Attempt to fetch a cache if it exists. 
    const cache = Web.cacheTable[request.getPath()];

    if (cache)
    {
        // Write our cached response.
        response.write(cache, "text/html", "gzip");

        // Return finish.
        return FINISH;
    }

    return CONTINUE;
}

/**
 * Handles any raw request to the web server.
 */
Web.handleRequest = function(response, request)
{
    // Attempt to fetch our route.
    const route = Web.routeTable[request.getAbsPath()];
    
    // Check if our route exists, if not, return CONTINUE.
    if (!route) return CONTINUE;

    // Check if our route is an endpoint.
    if (route.endpoint) 
    {
        // Call the endpoint callback.
        return route.endpoint(response, request); 
    }

    //////////////////////////////////////////

    // Otherwise pass to the handle route method. 
    return Web.handleRoute(response, request, route.template);
}

/**
 * Handles every routed request.
 */ 
Web.handleRoute = async function(response, request, routeTemplate)
{
    // Setup a boolean that will determine whether we should cache the page.
    response.cache = false;
 
    // Get our rendered page.
    const rendered = await routeTemplate(
        {  
            response: response,
            request: request 
        }
    ); 
 
    // Get the path of the request.
    const path = request.getPath(); 

    // Check if we should cache.
    if (response.cache && !(path in Web.cacheTable))
    {   
        // Place an empty string inside while we compress.
        Web.cacheTable[path] = "";
 
        // Generate a gzip content.
        gzip.compress(rendered, 9).then((cache) => 
        {
            // Add the cache to the cache table.
            Web.cacheTable[path] = cache;

            print(`${Web.LOG_TAG} Finished caching for ${path}`);
        });

        print(`${Web.LOG_TAG} Caching response for ${path}`);
    }

    // Otherwise, write our rendered page.
    response.write(rendered);

    return FINISH;
}

/**
 * Adds route(s) to the route table.
 */
Web.addRoute = function(paths, fileName)
{
	const str = fs.read(fileName);
	const template = ejs.compile(str, {
        async: true
    });
	
	for (let i = 0; i < paths.length; i++)
	{
        const path = paths[i];
        
        Web.routeTable[path] = 
        {
            template: template,
            fileName: fileName
        }; 

        print(`${Web.LOG_TAG} Setting up route: ${path} -> ${fileName}`);
	}
}

/**
 * Adds endpoint to the route table.
 */
Web.addEndpoint = function(path, callback)
{
    Web.routeTable[path] = 
    {
        endpoint: callback
    }; 

    print(`${Web.LOG_TAG} Setting up endpoint: ${path}`);
}

/**
 * Handles any file system directory updates 
 */
Web.directoryUpdate = function()
{
    for (const path in Web.routeTable) 
    {
        const route = Web.routeTable[path];

        // Skip endpoints.
        if (route.endpoint) continue;

        const str = fs.read(route.fileName);
        const template = ejs.compile(str, {
            async: true
        });

        route.template = template;
        
        print(`${Web.LOG_TAG} Updating route "${path}".`);
    }

    Web.clearCache();

    if (Web.directoryUpdateCallback)
        Web.directoryUpdateCallback();
}

/**
 * Initializes the web framework.
 */
Web.init = function() 
{
    // Check if the user wants to manually call handle request.
    register(Web.handleRequest);
    register(PRE_BEGIN_REQUEST, Web.handlePreBeginRequest);
      
    // Register for directory updates.
    fs.register(Web.directoryUpdate)
}

/**
 * Sets the callback.
 */
Web.setDirectoryUpdateCallback = function(callback)
{
    this.directoryUpdateCallback = callback;
}

/**
 * Clears the cache table.
 */
Web.clearCache = function()
{
    print(`${Web.LOG_TAG} Clearing cache table.`);

    Web.cacheTable = {};
}
