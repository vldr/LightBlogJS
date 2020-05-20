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

    // Attempt to fetch a cache if it exists. 
    const cache = Web.cacheTable[request.getPath()];

    if (cache)
    {
        // Write our cached response.
        response.write(cache, "text/html", "gzip");

        // Return finish.
        return FINISH;
    }

    // Otherwise pass to the handle route method. 
    return Web.handleRoute(response, request, route.template);
}

/**
 * Handles every routed request.
 */ 
Web.handleRoute = function(response, request, routeTemplate)
{
    // Setup a boolean that will determine whether we should cache the page.
    response.cache = false;
 
    // Get our rendered page.
    const rendered = routeTemplate(
        {
            response: response,
            request: request
        }
    );

    // Check if we should cache.
    if (response.cache)
    {
        // Generate a gzip content.
        const cache = pako.gzip(rendered);

        // Add the cache to the cache table.
        Web.cacheTable[request.getPath()] = cache;

        print(`${Web.LOG_TAG} Caching response for ${request.getPath()}`);

        // Write our response.
        response.write(cache, "text/html", "gzip")
    }
    else 
    {
        // Otherwise, write our rendered page.
        response.write(rendered);
    }

    return FINISH;
}

/**
 * Adds route(s) to the route table.
 */
Web.addRoute = function(paths, fileName)
{
	const str = fs.read(fileName);
	const template = ejs.compile(str);
	
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
        const template = ejs.compile(str);

        route.template = template;
        
        print(`${Web.LOG_TAG} Updating route "${path}".`);
    }

    Web.cacheTable = {};
}

/**
 * Initializes the web framework.
 */
Web.init = function(shouldRegister = true) 
{
    if (shouldRegister)
        register(Web.handleRequest);
        
    fs.register(Web.directoryUpdate);
}
