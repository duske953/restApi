const axios = require("axios");
const cheerio = require("cheerio");
const res = require("express/lib/response");
const func = require("./modelFunc.js")
const modelState = require("./modelState.js")

module.exports = {
    async getAmazonResults(){
    try{
       const amazon = await axios.get("https://www.amazon.com/s?k=iphone+13");
       const $ = cheerio.load(amazon.data)
       $(".s-widget-container > div.s-card-container").each((ind,ele) => {
           modelState.results.amazon = func.getHtml($,ele,"img","span.a-size-medium","span.a-price-whole","a")
           
       })
    }catch(err){
        throw err;
    }
    },

    async getEbayResults(){
        try{
        const ebay = await axios.get("https://www.ebay.com/sch/i.html?_from=R40&_nkw=iphone+13&_sacat=0");
        const $ = cheerio.load(ebay.data);
        $(".s-item ").each((ind,ele) => {
            modelState.results.ebay = func.getHtml($,ele,"img",".s-item__title",".s-item__price","a");
           
        });
    }catch(err){
        throw err;
    }
    },

    async getJumiaResults(){
        try{
        const jumia = await axios.get("https://www.jumia.com.ng/catalog/?q=iphone+13")
        const $ = cheerio.load(jumia.data)
        $(".c-prd").each((ind,ele) => {
            modelState.results.jumia =  func.getHtml($,ele,"img",".name",".prc","a",false);
           
        });
    }catch(err){
        throw err;
    }
    },

    async getKongaResults(){
        try{
        const konga = await axios.get("https://www.konga.com/search?search=iphone13")
        const $ = cheerio.load(konga.data)
        console.log(konga.data)
        $("img._59c59_3-MyH.lazyloaded").each((ind,ele) => {
            console.log($(ele).attr("src"))
        })
        }catch(err){
            throw err
        }
    }
}