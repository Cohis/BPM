const express = require('express');
const app = express();
const fs = require('fs');
const path = require('path');
const CD = require('content-disposition');
const contentDisposition = require('content-disposition');



app.get('/songs', (req, res) => {

    const songpath = path.join(__dirname, 'songs');

    res.json(fs.readdirSync(songpath));

})


app.get('/songs/:file', (req, res) => {
    
    //pegar a música com path.join
    //verificar se ela existe e fazer o stream

    const song = path.join(__dirname, '/songs/' + req.params.file);
    console.log(req.params);

    if(fs.existsSync(song)){

        //Está entrando no if corretamente

        const stream = fs.createReadStream(song);

        //setamos um Header para que o navegador saiba qual ação tomar

        res.setHeader('Content-Type','audio/mp3');

        stream.pipe(res)

        console.log("DEBUG:", song);
    }

    else{

        console.log("Song not found :(")
    }

})

app.get('/songs/:file/download', (req,res) => {

    const song = path.join(__dirname, '/songs/' +req.params.file);

    if(fs.existsSync(song)){
        const stream = fs.createReadStream(song);

        res.setHeader('Content-Disposition', contentDisposition(req.params.file));

        stream.pipe(res);

        console.log("DEBUG:", song);
    }

    else{
        console.log("Song not found :(");
    }

})


app.listen(8080, () => {
    console.log('Server is running at port 8080')
})