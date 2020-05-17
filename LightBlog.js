load("Web.js");
load("Scrypt.js");

//////////////////////////////////////////////
 
// Setup our light blog object.
var LightBlog = {};

// The connection string to the database.
LightBlog.DB_CONNECTION_STRING = "sqlite3:db=C:\\Users\\Public\\db.db";

// The prefixed tag used on logs.
LightBlog.LOG_TAG = "[LIGHTBLOG]";

/**
 * Initializes the lightblog database and web framework.
 */
LightBlog.init = function()
{
    LightBlog.initDb();

    Web.init(); 
    Web.addRoute(["/", "/index"], "index.ejs");  
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
            title VARCHAR(255) UNIQUE,
            content TEXT, 
            preview_content TEXT, 
            draft_content TEXT, 
            post_date TEXT,
            edit_date TEXT
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
 * Returns an object containg the homepage depending on the page.
 */
LightBlog.fetchHomepage = function(page = 0)
{
    // The object that will be returned.
    let posts = [];
 
    // Initialize a db object.
    let con = db.init(LightBlog.DB_CONNECTION_STRING);

    // Catch any exceptions.
    try 
    {
        con.prepare(`SELECT users.display_name, posts.preview_content, posts.title, posts.owner 
            FROM posts INNER JOIN users ON posts.id=posts.owner
        `);
        con.query();

        while (con.next())
        {
            posts.push(
                {
                    author: con.fetch(DB_STRING, 0),
                    content: con.fetch(DB_STRING, 1),
                    title: con.fetch(DB_STRING, 2)
                }
            );
        }

        //////////////////////////////////////

        con.close();
    } 
    catch (e)
    {
        // Log that we've hit an exception.
        print(`${LightBlog.LOG_TAG} Failed fetch homepage (${page}). ${e}`);

        // Close our database connection.
        con.close();

        // Return a null object indicating an error.
        return null;
    }

    // Return our posts object.
    return posts;
}

LightBlog.fetchPost = function(id)
{
    
}