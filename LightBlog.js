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

// The name of the users json file.
LightBlog.USERS_FILE_NAME = "users.json";
LightBlog.SESSION_FILE_NAME = "sessions.json";

// The name of the session cookie.
LightBlog.SESSION_NAME = "lightblog.session";

// The length of the session identifier.
LightBlog.SESSION_IDENTIFIER_LENGTH = 33;

// The amount of time(ms) a session stays valid for.
LightBlog.SESSION_EXPIRY = 1500000;
LightBlog.SESSION_EXPIRY_EXTENDED = 959000000;

// Path to the dashboard.
LightBlog.DASHBOARD_PATH = "/admin/dashboard";

// The path to index.
LightBlog.INDEX_PATH = "/admin/";

// Paths to the style and admin path.
LightBlog.STYLE_PATH = "/style.css";
LightBlog.ADMIN_STYLE_PATH = "/admin.css";

// The object containg all the session by the session identifier.
LightBlog.sessionTable = {};

// A list containing all the users.
LightBlog.usersTable = [];
 
/**
 * Initializes the lightblog database and web framework.
 */
LightBlog.init = function()
{ 
    LightBlog.initDb();
    LightBlog.initUsers();
    LightBlog.initSession();
 
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
    Web.addEndpoint("/admin/update/post", LightBlog.handleUpdatePostContent);  
}

/**
 * Initializes the database.
 */
LightBlog.initDb = function()
{
    // Initialize a db object.
    let con = null;

    // Catch any exceptions.
    try 
    {
        con = db.init(LightBlog.DB_CONNECTION_STRING);
 
        //////////////////////////////////////

        // Create our posts table.
        con.prepare(`CREATE TABLE IF NOT EXISTS posts (
            id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
            owner INTEGER NOT NULL,
            title TEXT UNIQUE NOT NULL DEFAULT '',
            display_title TEXT NOT NULL DEFAULT '',
            content TEXT NOT NULL DEFAULT '', 
            preview_content TEXT NOT NULL DEFAULT '', 
            keywords TEXT NOT NULL DEFAULT '', 
            desc TEXT NOT NULL DEFAULT '', 
            post_date TEXT NOT NULL DEFAULT '',
            cover_photo TEXT NOT NULL DEFAULT '',
            is_hidden INTEGER DEFAULT 1
        )`);
        con.execSync();

        //////////////////////////////////////

        // Create an index so we can fetch posts by the title.
        con.reset();  
        con.prepare(`CREATE INDEX IF NOT EXISTS title_index ON posts(title);`);
        con.execSync();
        
        //////////////////////////////////////

        // Close our connection.
        con.close();

        //////////////////////////////////////

        print(`${LightBlog.LOG_TAG} Successfully initialized db.`);
    } 
    catch (e)
    {
        print(`${LightBlog.LOG_TAG} Failed to initialize db. (${e})`);

        if (con)
            con.close();
    }
}

/**
 * Initializes the session table.
 */
LightBlog.initSession = async function()
{
    // Check if the file exists.
    if (!fs.exists(LightBlog.SESSION_FILE_NAME))
    {
        print(`${LightBlog.LOG_TAG} No ${LightBlog.SESSION_FILE_NAME} file exists, skipping.`);
        return;
    }

    // Fetch the users file.
    const data = fs.read(LightBlog.SESSION_FILE_NAME);

    // Update the session table.
    LightBlog.sessionTable = JSON.parse(data);

    print(`${LightBlog.LOG_TAG} Initialized sessions successfully.`);
}

/**
 * Initializes the users table.
 */
LightBlog.initUsers = async function()
{
    try 
    {
        // Check if the file exists.
        if (!fs.exists(LightBlog.USERS_FILE_NAME))
        {
            print(`${LightBlog.LOG_TAG} No ${LightBlog.USERS_FILE_NAME} file exists, skipping.`);
            return;
        }

        // Fetch the users file.
        const data = fs.read(LightBlog.USERS_FILE_NAME);

        // Parse the json data.
        const users = JSON.parse(data);
 
        //////////////////////////////////////

        if (!Array.isArray(users))
            throw "users object is not an array."

        // Check if all properties exist.
        for (let i = 0; i < users.length; i++)
        {
            const user = users[i];

            // Set the user id as the index.
            user.id = i;

            if (!user.username)
                throw `user at index (${i}) is missing a username.`;

            if (!user.name)
                throw `user at index (${i}) is missing a name.`;

            if (user.password)
            {
                // Generate a hash if one doesn't exist.
                user.hash = await crypto.bcrypt.hash(user.password);

                // Delete the user's password original password.
                delete user.password;

                // Write our parsed results back into the file.
                fs.write(LightBlog.USERS_FILE_NAME, JSON.stringify(users));
            }

            if (!user.hash)
                throw `user at index (${i}) is missing a hash (hashed password).`;
        }

        // Update our current users table with a sorted users table.
        LightBlog.usersTable = users.sort((a, b) => a.username.localeCompare(b.username));

        //////////////////////////////////////

        print(`${LightBlog.LOG_TAG} Successfully initialized users.`);
    } 
    catch (e)
    {
        print(`${LightBlog.LOG_TAG} Failed to initialize users. (${e})`);
    }
}

/**
 * Uses binary search to find user by username.
 */
LightBlog.findUserByUsername = function(username) 
{ 
    let mid = 0;
    let low = 0;
    let high = LightBlog.usersTable.length - 1;
 
    while (high >= low) 
    {
        mid = Math.floor((high + low) / 2); 

        const comparision = LightBlog.usersTable[mid].username.localeCompare(username);
   
        if (comparision < 0) 
        {
            low = mid + 1;
        }
        else if (comparision > 0) 
        {
            high = mid - 1;
        }
        else 
        {
            return LightBlog.usersTable[mid];
        }
    } 
   
    return null; 
} 

/**
 * Generates a random string with given length.
 */
LightBlog.randomString = function(length)
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

/**
 * Gets the current date formatted.
 */
LightBlog.formattedDate = function() 
{
    const now = new Date();
    const days = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
    const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];

    const day = days[now.getDay()];
    const month = months[now.getMonth()];

    return `${day}, ${month} ${now.getDate()}, ${now.getFullYear()}`;
}

/**
 * Transforms a title into a id title.
 */
LightBlog.parseTitle = function(title)
{
   return title.toLowerCase().trim().replace(/[^0-9a-z\s\-]/gi, "").replace(/\s/g, "-");
}

/**
 * Returns a list of posts 
 * @param page The page number of which posts lie in.
 * @returns Post object.
 */
LightBlog.getPosts = async function(page = "0")
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
                preview_content, 
                title, 
                post_date, 
                cover_photo, 
                display_title, 
                is_hidden,
                owner
                FROM posts
                ORDER BY posts.id DESC
            `);
        }
        // Otherwise, fetch the first 10 posts by the offset.
        else
        { 
            // Prepare our statement.
            con.prepare(`
                SELECT preview_content, title, post_date, cover_photo, display_title, is_hidden, owner
                FROM posts
                WHERE is_hidden=0
                ORDER BY id DESC
                LIMIT 10 OFFSET ?
            `);

            // Calculate the offset.
            const offset = (parseInt(page, 10) || 0) * 10;

            // Bind our offset number. 
            con.bind(offset);
        }
        
        // Query our statement.
        await con.query();

        // Loop throughout all the results.
        while (con.next())  
        {
            const owner = con.fetch(db.STRING, "owner");
            const author = LightBlog.usersTable[owner] ? LightBlog.usersTable[owner].name : "(unknown)";

            // Push our post to the list.
            posts.push(
                {
                    author,
                    content: con.fetch(db.STRING, "preview_content"),
                    id: con.fetch(db.STRING, "title"),
                    date: con.fetch(db.STRING, "post_date"),
                    coverPhoto: con.fetch(db.STRING, "cover_photo"), 
                    title: con.fetch(db.STRING, "display_title"),
                    isHidden: con.fetch(db.BOOL, "is_hidden")
                }
            );
        }

        //////////////////////////////////////

        con.close();
    } 
    catch (e)
    {
        // Log that we"ve hit an exception.
        print(`${LightBlog.LOG_TAG} Exception at getPosts (${page}, ${e}).`);

        // Close our database connection if it isn"t null.
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
 * @returns A post object, or **null** if it doesn"t exist.
 */
LightBlog.getPost = async function(id, showHidden = false)
{
    // Check if we we"re given an invalid id.
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
            posts.content, 
            posts.display_title, 
            posts.post_date, 
            posts.cover_photo, 
            posts.is_hidden,
            posts.keywords,
            posts.desc,
            posts.title,
            posts.preview_content,
            posts.owner 
            FROM posts
            WHERE posts.title=?
        `
        :
        `
            SELECT 
            posts.content, 
            posts.preview_content, 
            posts.display_title, 
            posts.post_date, 
            posts.cover_photo,
            posts.keywords,
            posts.desc,
            posts.owner 
            FROM posts
            WHERE posts.title=? AND posts.is_hidden=0
        `);

        // Bind our id.
        con.bind(id);

        //////////////////////////////////////

        // Check if we got any results.
        if (!await con.queryRow())
            throw "no post was found";

        //////////////////////////////////////

        const owner = con.fetch(db.STRING, "owner");
        const author = LightBlog.usersTable[owner] ? LightBlog.usersTable[owner].name : "(unknown)";

        // Setup a post object.
        const post = showHidden ? 
        {
            author,
            content: con.fetch(db.STRING, "content"),
            title: con.fetch(db.STRING, "display_title"),
            date: con.fetch(db.STRING, "post_date"),
            coverPhoto: con.fetch(db.STRING, "cover_photo"),
            isHidden: con.fetch(db.BOOL, "is_hidden"),
            id: con.fetch(db.STRING, "title"),
            previewContent: con.fetch(db.STRING, "preview_content"),
            desc: con.fetch(db.STRING, "desc"),
            keywords: con.fetch(db.STRING, "keywords")
        } 
        :
        {
            author,
            content: con.fetch(db.STRING, "content"),
            previewContent: con.fetch(db.STRING, "preview_content"),
            title: con.fetch(db.STRING, "display_title"),
            date: con.fetch(db.STRING, "post_date"),
            coverPhoto: con.fetch(db.STRING, "cover_photo"),
            desc: con.fetch(db.STRING, "desc"),
            keywords: con.fetch(db.STRING, "keywords")
        };

        //////////////////////////////////////

        // Close our connection.
        con.close();

        //////////////////////////////////////

        return post;
    } 
    catch (e)
    {
        // Log that we"ve hit an exception.
        print(`${LightBlog.LOG_TAG} Exception at getPost (${id}, ${e}). `);

        // Close our database connection.
        if (con)
            con.close();
    }

    // Return a null object indicating an error.
    return null
}
 
/**
 * Returns a session object if it exists.
 */
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

        //////////////////////////////////////

        // Fetch the session.
        const session = LightBlog.sessionTable[sessionIdentifier];

        // Check if our session object exists.
        if (!session)
            return null;

        //////////////////////////////////////

        // Get the current date.
        const now = new Date();

        // Check if the session has expired.
        if (now - session.created > session.expires)
        {
            // Delete the session.
            delete LightBlog.sessionTable[sessionIdentifier];

            // Return null.
            return null;
        }
        else session.created = now;

        //////////////////////////////////////
        
        // Return the session object.
        return session;
    } 
    catch (e)
    {
        // Log our error.
        print(`${LightBlog.LOG_TAG} Exception at getSession (${e})`);

        // Return null.
        return null;
    }
}

/**
 * Handles logging users out.
 */
LightBlog.handleLogout = function(response, request)
{
    const session = LightBlog.getSession(response, request);

    if (session)
    {
        delete LightBlog.sessionTable[session.tag];
    }

    response.redirect(LightBlog.INDEX_PATH, true, false);

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

        const user = LightBlog.findUserByUsername(info.username);

        if (!user)
            throw "no such user with that username was found.";
 
        // Fetch our hashed password.
        const hashedPassword = user.hash;

        ////////////////////////////////////

        if (!await crypto.bcrypt.check(info.password, hashedPassword))
            throw "invalid password provided."

        ////////////////////////////////////

        // Generate the session identifier.
        const sessionIdentifier = LightBlog.randomString(LightBlog.SESSION_IDENTIFIER_LENGTH);

        // Throw if our session identifier is a duplicate.
        if (sessionIdentifier in LightBlog.sessionTable)
            throw "duplicate session identifier";

        // Generate the cookie string.
        const cookieString = Cookie.serialize(LightBlog.SESSION_NAME, sessionIdentifier, {
            maxAge: (info.rememberMe ? LightBlog.SESSION_EXPIRY_EXTENDED : LightBlog.SESSION_EXPIRY) / 1000,
            path: "/"
        });

        // Add our session object to the session table.
        LightBlog.sessionTable[sessionIdentifier] = 
        {
            created: new Date(),
            expires: info.rememberMe ? LightBlog.SESSION_EXPIRY_EXTENDED : LightBlog.SESSION_EXPIRY,
            tag: sessionIdentifier,
            id: user.id
        };

        // Set the cookie.
        response.setHeader("Set-Cookie", cookieString);

        ////////////////////////////////////

        // Perform a clean up.
        for (const key in LightBlog.sessionTable) 
        {
            // Fetch the session object.
            const session = LightBlog.sessionTable[key];       

            // Delete expired sessions.
            if (new Date() - session.created > session.expires)
            {
                delete LightBlog.sessionTable[key];
            }
        }

        fs.write(LightBlog.SESSION_FILE_NAME, JSON.stringify(LightBlog.sessionTable));

        ////////////////////////////////////

        // Set a successful result.
        result = { success: true };
    }
    catch (e)
    {
        // Log our error.
        print(`${LightBlog.LOG_TAG} Exception at handleLogin (${e})`);

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

/**
 * Handles checking if titles are available.
 */
LightBlog.handleCheckTitle = async function(response, request)
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
        result = { success: true, isTaken: await con.queryRow() };

        // Close our database connection.
        con.close();
    }
    catch (e)
    {
        // Log our error.
        print(`${LightBlog.LOG_TAG} Exception at handleCheckTitle (${e})`);

        // Close our connection if it"s open.
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

/**
 * Handles creating new posts.
 */
LightBlog.handleNewPost = async function(response, request)
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
        if (!info.title) 
            throw "no title provided.";

        // Transform our title.
        const title = LightBlog.parseTitle(info.title);

        if (!title)
            throw "no title provided. (2)";

        ////////////////////////////////////

        // Initialize our connection.
        con = db.init(LightBlog.DB_CONNECTION_STRING);

        // Prepare to select our user with the matching username.
        con.prepare(`INSERT INTO posts (owner, title, display_title, post_date) VALUES (?, ?, ?, ?)`);

        // Bind our values.
        con.bind(session.id);
        con.bind(title);
        con.bind(info.title);
        con.bind(LightBlog.formattedDate());

        // Execute our query.
        await con.exec();

        ////////////////////////////////////

        Web.clearCache();

        // Set a successful result.
        result = { success: true };

        // Close our database connection.
        con.close();
    }
    catch (e)
    {
        // Log our error.
        print(`${LightBlog.LOG_TAG} Exception at handleNewPost (${e})`);

        // Close our connection if it"s open.
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

/**
 * Handles updating content.
 */
LightBlog.handleUpdatePostContent = async function(response, request)
{
    // Setup a result object.
    let result = {
        success: false
    };
    
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
        let info = JSON.parse(
            request.read()
        );

        // Check if post id was provided.
        if (!info.id)
            throw "no id provided."

        ////////////////////////////////////

        // Initialize our connection.
        con = db.init(LightBlog.DB_CONNECTION_STRING);

        ////////////////////////////////////

        if (info.title && (title = LightBlog.parseTitle(info.title))) 
        {
            con.prepare(`UPDATE posts SET title = ?, display_title = ? WHERE title = ?`);

            con.bind(title);
            con.bind(info.title);
            con.bind(info.id);

            await con.exec();
            con.reset();

            result.success = true;
            result.id = title;       
        }
        else if ("delete" in info)
        {
            con.prepare(`DELETE FROM posts WHERE title = ?`);
            con.bind(info.id);

            await con.exec();

            result.success = true;
        }   
        else if ("content" in info) 
        {
            con.prepare(`UPDATE posts SET content = ? WHERE title = ?`);

            con.bind(info.content);
            con.bind(info.id);

            await con.exec();
            con.reset();

            result.success = true;
        }
        else if ("previewContent" in info) 
        {
            con.prepare(`UPDATE posts SET preview_content = ? WHERE title = ?`);

            con.bind(info.previewContent);
            con.bind(info.id);

            await con.exec();
            con.reset();

            result.success = true;
        }
        else if ("coverPhoto" in info) 
        {
            con.prepare(`UPDATE posts SET cover_photo = ? WHERE title = ?`);

            con.bind(info.coverPhoto);
            con.bind(info.id); 

            await con.exec();
            con.reset();

            result.success = true;
        }
        else if ("desc" in info) 
        {
            con.prepare(`UPDATE posts SET desc = ? WHERE title = ?`);

            con.bind(info.desc);
            con.bind(info.id); 

            await con.exec();
            con.reset();

            result.success = true;
        }
        else if ("keywords" in info) 
        {
            con.prepare(`UPDATE posts SET keywords = ? WHERE title = ?`);

            con.bind(info.keywords);
            con.bind(info.id); 

            await con.exec();
            con.reset();

            result.success = true;
        }
        else if ("hidden" in info) 
        {
            con.prepare(`UPDATE posts SET is_hidden = ? WHERE title = ?`);
 
            con.bind(info.hidden);
            con.bind(info.id);

            await con.exec();
            con.reset();

            result.success = true;
        }

        ////////////////////////////////////

        if (result.success)
        {
            // Clear our cache.
            Web.clearCache();
        }

        // Close our database connection.
        con.close();
    }
    catch (e)
    {
        // Log our error.
        print(`${LightBlog.LOG_TAG} Exception at handleUpdatePostContent (${e})`);

        // Close our connection if it"s open.
        if (con) 
           con.close();
    }
    
    /////////////////////////////////////////

    response.write(
        JSON.stringify(result),
        "application/json"
    );

    /////////////////////////////////////////

    return FINISH;
}
