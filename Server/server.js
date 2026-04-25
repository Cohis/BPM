require('dotenv').config()
const express = require('express');
const app = express();
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');

//Welcome to HeartBeat!
//Without music, the world would be just a rock! ;)
//Dev by: Murilo Rodrigues Damasceno dos Santos - 2026


app.use(express.json()) //activating middleware
//now, express will read all POST req's body and transform JSON in a Javascript object
//the object will be called req.body

app.get('/songs', authmiddleware, (req, res) => {

    const songpath = path.join(__dirname, 'songs');

    res.json(fs.readdirSync(songpath));

})


app.get('/songs/:file', authmiddleware, (req, res) => {
    
   streamsong(req.params.file, res)
})



app.get('/songs/:file/download', authmiddleware, (req,res) => {

    streamsong(req.params.file, res, true)
})



function streamsong(filename, res, download = false){

    //building songpath
    const song = path.join(__dirname, '/songs/' + filename);

    //verify if the song is available
    if(fs.existsSync(song)){

        const stream = fs.createReadStream(song);

        //This is the Header meant for downloading content
        if(download)
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

        else
            res.setHeader('Content-Type', 'audio/mp3');


        stream.pipe(res)

    }

}

const USER = 'myself'
const PASSWORD = 'password'

app.post('/auth', (req, res) => {

    const { us, pass } = req.body

    if (us ===  USER && pass === PASSWORD) {
        
        //generating jsonwebtoken
        const token = jwt.sign(
            {user : us}, // user info
            process.env.JWT_SECRET, //secret key
            { expiresIn: '1h'}
         );

         res.json({token});

    }

    else {
        return res.status(401).json({ error: 'Invalid credentials'});
    }

})

//I must create an auth function, it will verify if the user is logged everytime they try to access a song
function authmiddleware(req, res, next) {
    const authHeader = req.headers['authorization']; //the headers w JWT

    if(!authHeader) return res.sendStatus(401); //they get prohibited if they don't have an authorized JWT

    const token = authHeader.split(' ')[1];

    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if(err) return res.sendStatus(403); //they have a JWT, but it's not a JWT recognized by HeartBeat!

        req.user = decoded;
        next();
    });

}


app.listen(8080, () => {
    console.log('Server is running at port 8080')
})