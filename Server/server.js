require('dotenv').config()
const express = require('express');
const app = express();
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');

//Welcome to HeartBeat, Hunters!
//The world is a better place w music! ;)

app.get('/songs', (req, res) => {

    const songpath = path.join(__dirname, 'songs');

    res.json(fs.readdirSync(songpath));

})


app.get('/songs/:file', (req, res) => {
    
   streamsong(req.params.file, res)
})



app.get('/songs/:file/download', (req,res) => {

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



app.listen(8080, () => {
    console.log('Server is running at port 8080')
})