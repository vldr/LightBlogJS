var LightBlog = {};

// The connection string to the database.
LightBlog.DB_CONNECTION_STRING = "sqlite3:db=C:\\Users\\Public\\db.db";

// The prefixed tag used on logs.
LightBlog.LOG_TAG = "[LIGHTBLOG]";

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
        con.prepare(`create table if not exists users (
            id integer primary key autoincrement not null,
            username text,
            nickname text,
            pass text
        )`);
        con.exec();

        //////////////////////////////////////

        con.reset();
        con.prepare(`create table if not exists posts (
            id integer primary key autoincrement not null,
            title text,
            content BLOB, 
            postid text UNIQUE,
            postdate text,
            author text
        )`);
        con.exec();
        con.close();

        print(`${LightBlog.LOG_TAG} Successfully initialized db.`);
    } 
    catch (e)
    {
        print(`${LightBlog.LOG_TAG} Failed to initialize db. ${e}`);
        con.close();
    }
}

/**
 * Renders the home page.
 */
LightBlog.renderHomePage = function(response, request, page = 0)
{
    Web.fetchSession(response, request);
}