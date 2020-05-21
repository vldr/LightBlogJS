load("Web.js");
load("Marked.js");
load("Cookie.js");

//////////////////////////////////////////////
 
// Setup our light blog object.
var LightBlog = {};

// The connection string to the database.
LightBlog.DB_CONNECTION_STRING = "sqlite3:db=C:\\Users\\Public\\db.db";

// The prefixed tag used on logs.
LightBlog.LOG_TAG = "[LIGHTBLOG]";

// The name of the session cookie.
LightBlog.SESSION_NAME = "lightblog.session";

// The length of the session identifier.
LightBlog.SESSION_IDENTIFIER_LENGTH = 33;

// The amount of time(ms) a session stays valid for.
LightBlog.SESSION_EXPIRY = 1500000;

// Path to the dashboard.
LightBlog.DASHBOARD_PATH = "/admin/dashboard";

// The path to index.
LightBlog.INDEX_PATH = "/admin/";

// The array containg all the session.
LightBlog.sessionTable = {};
 
/**
 * Initializes the lightblog database and web framework.
 */
LightBlog.init = function()
{ 
    LightBlog.initDb();

    Web.init(); 
    Web.addRoute(["/", "/index"], "index.ejs");  
    Web.addRoute(["/view"], "view.ejs");  
    Web.addRoute(["/admin/", "/admin/index"], "admin/login.ejs");  
    Web.addRoute(["/admin/dashboard"], "admin/dashboard.ejs");  
    Web.addRoute(["/admin/add"], "admin/add.ejs");  
    Web.addRoute(["/admin/edit"], "admin/edit.ejs");   
    
    Web.addEndpoint("/admin/login", LightBlog.handleLogin);  
    Web.addEndpoint("/admin/logout", LightBlog.handleLogout);  
    Web.addEndpoint("/admin/check", LightBlog.handleCheckTitle);  
    Web.addEndpoint("/admin/new/post", LightBlog.handleNewPost);  
}

/**
 * Initializes the database.
 */
LightBlog.initDb = function()
{
    // Initialize a db object.
    let con = db.init(LightBlog.DB_CONNECTION_STRING);

    // Catch any exceptions.
    try 
    {
        // Create our users table.
        con.prepare(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
            username TEXT,
            display_name TEXT,
            password TEXT
        )`);
        con.exec();
 
        //////////////////////////////////////

        // Create our posts table.
        con.reset();
        con.prepare(`CREATE TABLE IF NOT EXISTS posts (
            id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
            owner INTEGER NOT NULL,
            title TEXT UNIQUE,
            display_title TEXT,
            content TEXT, 
            preview_content TEXT, 
            draft_content TEXT, 
            post_date TEXT,
            edit_date TEXT,
            cover_photo TEXT,
            is_hidden INTEGER DEFAULT 1
        )`);
        con.exec();

        //////////////////////////////////////

        // Create an index so we can fetch posts by the title.
        con.reset();  
        con.prepare(`CREATE INDEX IF NOT EXISTS title_index ON posts(title);`);
        con.exec();
        
        //////////////////////////////////////

        // Close our connection.
        con.close();

        //////////////////////////////////////

        print(`${LightBlog.LOG_TAG} Successfully initialized db.`);
    } 
    catch (e)
    {
        print(`${LightBlog.LOG_TAG} Failed to initialize db. (${e})`);
        con.close();
    }
}

/**
 * Returns a list of posts 
 * @param page The page number of which posts lie in.
 * @returns Post object.
 */
LightBlog.getPosts = function(page = "0")
{
    // Remove any question marks. 
    page = page.replace("?", "");

    // The object that will be returned.
    let posts = [];
 
    // Initialize a db object. 
    let con = null;

    // Catch any exceptions.
    try 
    {
        // Get the db object.
        con = db.init(LightBlog.DB_CONNECTION_STRING);

        // Check if we want to get all the posts.
        if (page == "-1")
        {
            con.prepare(`
                SELECT 
                users.display_name, 
                posts.preview_content, 
                posts.title, 
                posts.post_date, 
                posts.cover_photo, 
                posts.display_title, 
                posts.is_hidden,
                posts.owner
                FROM posts INNER JOIN users ON users.id=posts.owner
                ORDER BY posts.id DESC
            `);
        }
        // Otherwise, fetch the first 10 posts by the offset.
        else
        {
            // Prepare our statement.
            con.prepare(`
                SELECT 
                users.display_name, 
                posts.preview_content, 
                posts.title, 
                posts.post_date, 
                posts.cover_photo, 
                posts.display_title, 
                posts.is_hidden,
                posts.owner
                FROM posts INNER JOIN users ON users.id=posts.owner
                WHERE posts.is_hidden=0
                ORDER BY posts.id DESC
                LIMIT 10 OFFSET ?
            `);

            // Calculate the offset.
            const offset = (parseInt(page, 10) || 0) * 10;

            // Bind our offset number.
            con.bind(offset);
        }
        
        // Query our statement.
        con.query();

        // Loop throughout all the results.
        while (con.next()) 
        {
            // Push our post to the list.
            posts.push(
                {
                    author: con.fetch(DB_STRING, 0),
                    content: con.fetch(DB_STRING, 1),
                    id: con.fetch(DB_STRING, 2),
                    date: con.fetch(DB_STRING, 3),
                    coverPhoto: con.fetch(DB_STRING, 4), 
                    title: con.fetch(DB_STRING, 5),
                    isHidden: con.fetch(DB_BOOL, 6)
                }
            );
        }

        //////////////////////////////////////

        con.close();
    } 
    catch (e)
    {
        // Log that we've hit an exception.
        print(`${LightBlog.LOG_TAG} Failed fetch homepage (${page}, ${e}).`);

        // Close our database connection if it isn't null.
        if (con)
            con.close();

        // Return a null object indicating an error.
        return null;
    }

    // Return our posts object.
    return posts;
}

/**
 * Fetchs a given post.
 * @param id The title of the post. (not display title)
 * @returns A post object, or **null** if it doesn't exist.
 */
LightBlog.getPost = function(id, showHidden = false)
{
    // Check if we we're given an invalid id.
    if (id == null) return null;

    // Remove any question marks. 
    id = id.replace("?", "");

    // Setup a null connection object.
    let con = null;

    // Catch any exceptions.
    try 
    {
        // Initialize our connection.
        con = db.init(LightBlog.DB_CONNECTION_STRING);

        // Prepare our statement.
        con.prepare(showHidden ? `
            SELECT 
            users.display_name, 
            posts.content, 
            posts.display_title, 
            posts.post_date, 
            posts.cover_photo, 
            posts.is_hidden,
            posts.title,
            posts.preview_content,
            posts.draft_content,
            posts.edit_date,
            posts.owner 
            FROM posts INNER JOIN users ON users.id=posts.owner 
            WHERE posts.title=?
        `
        :
        `
            SELECT 
            users.display_name, 
            posts.content, 
            posts.display_title, 
            posts.post_date, 
            posts.cover_photo,
            posts.owner 
            FROM posts INNER JOIN users ON users.id=posts.owner 
            WHERE posts.title=? AND posts.is_hidden=0
        `);

        // Bind our id.
        con.bind(id);

        //////////////////////////////////////

        // Check if we got any results.
        if (!con.queryRow())
            throw "no post was found";

        //////////////////////////////////////

        // Setup a post object.
        const post = showHidden ? 
        {
            author: con.fetch(DB_STRING, 0),
            content: con.fetch(DB_STRING, 1),
            title: con.fetch(DB_STRING, 2),
            date: con.fetch(DB_STRING, 3),
            coverPhoto: con.fetch(DB_STRING, 4),
            isHidden: con.fetch(DB_BOOL, 5),
            id: con.fetch(DB_STRING, 6),
            previewContent: con.fetch(DB_STRING, 7),
            draftContent: con.fetch(DB_STRING, 8),
            editDate: con.fetch(DB_STRING, 9)
        } 
        :
        {
            author: con.fetch(DB_STRING, 0),
            content: con.fetch(DB_STRING, 1),
            title: con.fetch(DB_STRING, 2),
            date: con.fetch(DB_STRING, 3),
            coverPhoto: con.fetch(DB_STRING, 4)
        };

        //////////////////////////////////////

        // Close our connection.
        con.close();

        //////////////////////////////////////

        return post;
    } 
    catch (e)
    {
        // Log that we've hit an exception.
        print(`${LightBlog.LOG_TAG} Failed fetch post (${id}, ${e}). `);

        // Close our database connection.
        if (con)
            con.close();
    }

    // Return a null object indicating an error.
    return null
}

LightBlog.getSession = function(response, request) 
{
    // Get the raw cookie header.
    const rawCookies = request.getHeader("Cookie");

    // Return null if no cookies exist.
    if (!rawCookies) return null;

    try 
    {
        // Attempt to parse our cookies.
        const cookies = Cookie.parse(rawCookies);

        // Fetch the session cookie.
        const sessionIdentifier = cookies[LightBlog.SESSION_NAME];

        // Check if our session exists in the given cookie.
        if (!sessionIdentifier)
            return null;

        // Return the session object.
        return LightBlog.sessionTable[sessionIdentifier];
    } 
    catch (e)
    {
        // Log our error.
        print(`${LightBlog.LOG_TAG} Exception at getSession (${e})`);

        // Return null.
        return null;
    }
}

LightBlog.handleLogout = function(response, request)
{
    const session = LightBlog.getSession(response, request);

    if (session)
    {
        delete LightBlog.sessionTable[session.tag];
    }

    response.redirect(LightBlog.INDEX_PATH, true, true);

    return FINISH;
}

/**
 * Handles a login to the admin panel.
 */
LightBlog.handleLogin = async function(response, request)
{
    // Setup a result object.
    let result = {};
    
    // Setup a empty connection variable.
    let con = null;

    try 
    {   const session = LightBlog.getSession(response, request);

        if (session)
            throw "already logged in."

        //////////////////////////////////////

        // Check if this is a POST request.
        if (request.getMethod() !== "POST")
            throw "invalid http method."

        ////////////////////////////////////

        // Parse our provided data.
        const info = JSON.parse(
            request.read()
        );

        // Check if a username and password was provided.
        if (!info.username || !info.password) 
            throw "no username or password provided.";

        ////////////////////////////////////

        // Initialize our connection.
        con = db.init(LightBlog.DB_CONNECTION_STRING);

        // Prepare to select our user with the matching username.
        con.prepare(`SELECT password, id, display_name FROM users WHERE username=? LIMIT 1`);

        // Bind our username.
        con.bind(info.username);

        // Query our single row.
        const isNonEmpty = con.queryRow();

        // Check if any user exists.
        if (!isNonEmpty) 
            throw "no matching user was found.";

        ////////////////////////////////////

        // Fetch our hashed password.
        const hashedPassword = con.fetch(DB_STRING, 0);

        ////////////////////////////////////

        if (!await crypto.bcrypt.check(info.password, hashedPassword))
            throw "invalid password provided."

        ////////////////////////////////////

        const randomString = (length) => 
        {
            let result = "";
            const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
            const charactersLength = characters.length;
            for (let i = 0; i < length; i++)
            {
                result += characters.charAt(
                    Math.floor(Math.random() * charactersLength)
                );
            }

            return result;
        };

        // Generate the session identifier.
        const sessionIdentifier = randomString(LightBlog.SESSION_IDENTIFIER_LENGTH);

        // Throw if our session identifier is a duplicate.
        if (sessionIdentifier in LightBlog.sessionTable)
            throw "duplicate session identifier";

        // Generate the cookie string.
        const cookieString = Cookie.serialize(LightBlog.SESSION_NAME, sessionIdentifier, { });

        // Add our session object to the session table.
        LightBlog.sessionTable[sessionIdentifier] = 
        {
            created: new Date(),
            tag: sessionIdentifier,
            id: con.fetch(DB_STRING, 1),
            name: con.fetch(DB_STRING, 2)
        };

        // Set the cookie.
        response.setHeader("Set-Cookie", cookieString);

        ////////////////////////////////////

        // Set a successful result.
        result = { success: true };

        // Close our database connection.
        con.close();
    }
    catch (e)
    {
        // Log our error.
        print(`${LightBlog.LOG_TAG} Exception at handleLogin (${e})`);

        // Close our connection if it's open.
        if (con) 
           con.close();

        // Set our result.
        result = {
           success: false, 
           reason: "failed to authenticate"
        };
    }
    
    /////////////////////////////////////////

    response.write(
        JSON.stringify(result),
        "application/json"
    );

    /////////////////////////////////////////

    return FINISH;
}

LightBlog.handleCheckTitle = function(response, request)
{
    // Setup a result object.
    let result = {};
    
    // Setup a empty connection variable.
    let con = null;

    try 
    {   const session = LightBlog.getSession(response, request);

        if (!session)
            throw "not logged in."

        //////////////////////////////////////

        // Check if this is a POST request.
        if (request.getMethod() !== "POST")
            throw "invalid http method."

        ////////////////////////////////////

        // Parse our provided data.
        const info = JSON.parse(
            request.read()
        );

        // Check if a title was provided
        if (!info.title || info.title.length === 0) 
            throw "no title provided.";

        ////////////////////////////////////

        // Initialize our connection.
        con = db.init(LightBlog.DB_CONNECTION_STRING);

        // Prepare to select our user with the matching username.
        con.prepare(`SELECT id FROM posts WHERE title=? LIMIT 1`);

        // Bind our username.
        con.bind(info.title);

        ////////////////////////////////////

        // Set a successful result.
        result = { success: true, isTaken: con.queryRow() };

        // Close our database connection.
        con.close();
    }
    catch (e)
    {
        // Log our error.
        print(`${LightBlog.LOG_TAG} Exception at handleCheckTitle (${e})`);

        // Close our connection if it's open.
        if (con) 
           con.close();

        // Set our result.
        result = {
           success: false, 
           reason: "failed to check title"
        };
    }
    
    /////////////////////////////////////////

    response.write(
        JSON.stringify(result),
        "application/json"
    );

    /////////////////////////////////////////

    return FINISH;
}

LightBlog.handleNewPost = function(response, request)
{
    // Setup a result object.
    let result = {};
    
    // Setup a empty connection variable.
    let con = null;

    try 
    {   const session = LightBlog.getSession(response, request);

        if (!session)
            throw "not logged in."

        //////////////////////////////////////

        // Check if this is a POST request.
        if (request.getMethod() !== "POST")
            throw "invalid http method."

        ////////////////////////////////////

        // Parse our provided data.
        const info = JSON.parse(
            request.read()
        );

        // Check if a title was provided
        if (!info.title || info.title.length === 0) 
            throw "no title provided.";

        // Transform our title.
        const title = info.title.toLowerCase().trim().replace(/[^0-9a-z\s]/gi, '').replace(/\s/g, "-");
        const displayTitle = info.title;

        ////////////////////////////////////

        // Initialize our connection.
        con = db.init(LightBlog.DB_CONNECTION_STRING);

        // Prepare to select our user with the matching username.
        con.prepare(`INSERT INTO posts (owner, title, display_title) VALUES (?, ?, ?)`);

        // Bind our values.
        con.bind(session.id);
        con.bind(title);
        con.bind(displayTitle);

        // Execute our query.
        con.exec();

        ////////////////////////////////////

        // Set a successful result.
        result = { success: true };

        // Close our database connection.
        con.close();
    }
    catch (e)
    {
        // Log our error.
        print(`${LightBlog.LOG_TAG} Exception at handleNewPost (${e})`);

        // Close our connection if it's open.
        if (con) 
           con.close();

        // Set our result.
        result = {
           success: false, 
           reason: "failed to create new post"
        };
    }
    
    /////////////////////////////////////////

    response.write(
        JSON.stringify(result),
        "application/json"
    );

    /////////////////////////////////////////

    return FINISH;
}
