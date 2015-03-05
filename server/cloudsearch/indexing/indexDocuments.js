// This script indexes documents in Cloudsearch.
var csd = require(__dirname + '/cloudsearchifyDocuments.js');
var cloudsearchdomain = require(__dirname + "/../../config/endpoints").cloudsearchdomain;
var amazonProductApi = require(__dirname + "/../../amazonProductAPI/product.controller");

var graphyc = require('../../graphyc.js');
var numberOfDocuments = 50;
var similarHash = {};
var q = [];
var orderedProducts = [];
var hashCount = 0;
var similarHT = {};
var seenHash = {};
var simArray = [];
var count = 0;
var parCount = 0;
var t = new Date().getTime();
console.log(t);
var adjacencyList = [];

var numberOfDocuments = 100000;
var count = 0;
var uniqueProductsContainer = {};

exports.indexDocuments = function(data) {
  var params = {
    contentType: 'application/json',
    documents: csd.cloudsearchifyDocuments(data)
  };

  return cloudsearchdomain.uploadDocuments(params, function(err, data) {
    if(err) {
      console.log(err, err.stack);
    }
    else {
      count += data.adds;
      console.log(count + " documents indexed!");
    }
  });
};

// Expecting: [[{product},[1,5,3,..],[{product},[1,5,3,..]...]
// add x, y, z coordinates to products that orients the products in the 3D world based on the popularity of a single product,
// and then webbing related products out from there
var insertModelCoordinates = function(productObjectPlusAdjacencyListArray, products) {
  products = products || [];

  // base case - initially one most popular product with 5 similar products, each with 5 similar, each with similar
  // so 1 + 5 * 5 * 5 = 126
  if(products.length > 126){
    return products;
  }

  productObjectPlusAdjacencyListArray.forEach(function(productObjectPlusAdjacencyList){
    var originalProduct = productObjectPlusAdjacencyList[0];
    var adjacencyList = productObjectPlusAdjacencyList[1];
    var productIndex;

    // add original product to products to return
    originalProduct = addCoordinatesToProduct(originalProduct, 0, 0, 0);
    products.push(originalProduct);

    // dequeue products from adjacency list and add coordinates to those products
    var i = 0;
    while(productIndex = adjacencyList.pop()){
      // assuming 5 products in adjacency list, create the following coordinates:
      //[1,0,0], [0,1,0], [0,0,1], [-1,0,0], [0,-1,0],
      var coordinates = [0,0,0];
      coordinates[i % 3] = i < 3 ? 1 : -1;
      var relatedProductObjectPlusAdjacencyList = productObjectPlusAdjacencyListArray[productIndex];

      // recurse through related product
      insertModelCoordinates(relatedProductObjectPlusAdjacencyList);

      // add coordinates to related product
      relatedProductObjectPlusAdjacencyList = addCoordinatesToProduct(relatedProductObjectPlusAdjacencyList, coordinates[0], coordinates[1], coordinates[2]);

      // add related product from adjacency list to products to return
      products.push(relatedProductObjectPlusAdjacencyList);
      i++;
    }
  });
};

// helper function to add coordinates to product
var addCoordinatesToProduct = function(relatedProductObjectPlusAdjacencyList, x, y, z){
  relatedProductObjectPlusAdjacencyList[0].coordinates = {
    x: x,
    y: y,
    z: z
  };

  return relatedProductObjectPlusAdjacencyList;
};

recurse = function(pageNo) {

  // retrieve products from amazon products api
  amazonProductApi.searchCart(pageNo, function(err, results) {
    var _results = [];
    var r2 = results.ItemSearchResponse.Items[0].Item;

    // Log errors, if any
    if(results.ItemSearchResponse.Items[0].Request[0].Errors) {
      console.log(results.ItemSearchResponse.Items[0].Request[0].Errors[0].Error[0].Message[0]);
    }
    var i = 0;
    var flag = false;
    console.log(r2.length);
    while(r2 && r2[i] && i < r2.length && i < 15) {
      var obj = r2[i];
      var product = {};

      // Sometimes no ItemAttributes Returned
      if(obj.ItemAttributes &&
        obj.ItemAttributes[0].ListPrice &&
        obj.ItemAttributes[0].Title &&
        obj.MediumImage &&
        obj.CustomerReviews &&
        obj.CustomerReviews[0].IFrameURL &&
        obj.Offers &&
        obj.Offers[0].TotalOffers &&
        +obj.Offers[0].TotalOffers[0] > 0 &&
        obj.SimilarProducts &&
        obj.SimilarProducts[0].SimilarProduct) {

        // filter out adult products, like dildos
        if(!(obj.ItemAttributes[0].IsAdultProduct && obj.ItemAttributes[0].IsAdultProduct[0] === "1")) {

          //filter out duplicate 'items' sold by different vendors
          if(!uniqueProductsContainer[obj.ASIN[0]]) {
            uniqueProductsContainer[obj.ASIN[0]] = true;
            // similarHash[obj.ASIN[0]] = obj.SimilarProducts[0].SimilarProduct;
            simArray = simArray.concat(obj.SimilarProducts[0].SimilarProduct.map(function(e) {
              e.linkASIN = obj.ASIN[0];
              e.ASIN = e.ASIN[0];
              return e;
            }));
            // build product entry to return to client
            product.product_id = obj.ASIN[0];
            product.price = parseInt(obj.ItemAttributes[0].ListPrice[0].Amount[0] / 100, 10);
            product.title = obj.ItemAttributes[0].Title[0];
            product.img_url = obj.MediumImage[0].URL[0];
            product.prod_attributes = JSON.stringify(obj.ItemAttributes[0]);
            product.category = obj.ItemAttributes[0].ProductGroup[0];

            // add coordinates to place products on screen as 3d models
            product.x = 0;
            product.y = 0;
            product.z = 0;

            _results.push(product);
            // var index = graph.al.length;
            // graph.al[index] = [product, simArray];
            // similarHash[hashCount] = product.product_id;
            // similarHT[product.product_id] = hashCount;
            // simArray.push(product);
            hashCount++;
            flag = true;
            simArray.forEach(function(e, i) {
                if (!(e.ASIN in seenHash)) {
                  seenHash[e.ASIN] = q.length;
                  q.push(e.ASIN);
                  orderedProducts.push(e);
                  // graph.add(e, [])
                }
            });
            //decrement number of total documents we want to return
            numberOfDocuments--;
          }
        }
      }

      //increment counter within while loop
      i++;
      // console.log(simArray.length);
      // //base case - when 12 search items have been built
      // if(i === r2.length - 1 || 1) {
      //   // if(_results.length > 0){
      //   //   exports.indexDocuments(_results);
      //   // }

      //   // if we have not reached the number of documents to index, continue fetching documents from amazon product api
      //   if(numberOfDocuments > 0 && 0) {
      //     recurse(pageNo + 1);
      //   } else {
      //     // console.log(similarHash, Object.keys(similarHash).length, simArray);
      //     var counter = 0;

      //   }
      // }
    }
    console.log(q.length, "Queue");
    processQ(0);
  });
};

recurse(1);

  // amazonProductApi.lookup()
  // while(simArray.length) {
    
  // }
var someC = 0;
function processQ(index) {
  console.log("ParCount");
  this.index = index;
  var someC = 0;
  q.forEach(function(e) {
    if (!(e in seenHash)) {
      someC++;
    }
  });
  // console.log("INDEX", index, seenHash, someC, q);
  setTimeout(function(){
    var e = q[index];
    var element = q[index]
    console.log("INDEX", e);
    if (!(e in seenHash) || 1){
      amazonProductApi.lookup(e, function(err, results) {
        if (results.ItemLookupErrorResponse && results.ItemLookupErrorResponse.Error) {
          console.log (results.ItemLookupErrorResponse.Error[0])
        }
        else {
          var r2 = results.ItemLookupResponse.Items[0].Item;

          // Log errors, if any
          if(results.ItemLookupResponse.Items[0].Request[0].Errors) {
            console.log(results.ItemLookupResponse.Items[0].Request[0].Errors[0].Error[0].Message[0]);
          }

          var obj = r2[0];
          var product = {};
          // Sometimes no ItemAttributes Returned
          if(obj.ItemAttributes &&
            obj.ItemAttributes[0].ListPrice &&
            obj.ItemAttributes[0].Title &&
            obj.MediumImage &&
            obj.CustomerReviews &&
            obj.CustomerReviews[0].IFrameURL &&
            obj.Offers &&
            obj.Offers[0].TotalOffers &&
            +obj.Offers[0].TotalOffers[0] > 0 &&
            obj.SimilarProducts &&
            obj.SimilarProducts[0].SimilarProduct) {

            // filter out adult products, like dildos
            if(!(obj.ItemAttributes[0].IsAdultProduct && obj.ItemAttributes[0].IsAdultProduct[0] === "1")) {
              var index = this.index;
              //filter out duplicate 'items' sold by different vendors
              if(!uniqueProductsContainer[obj.ASIN[0]]) {
                uniqueProductsContainer[obj.ASIN[0]] = true;
                // similarHash[obj.ASIN[0]] = obj.SimilarProducts[0].SimilarProduct;
                var someFlag = false;
                var simProds = [];
                var newArray = obj.SimilarProducts[0].SimilarProduct.map(function(e) {
                  e.linkASIN = obj.ASIN[0];
                  e.ASIN = e.ASIN[0];
                  simProds.push(e.ASIN)
                  if (!(e.ASIN in seenHash)) {
                    seenHash[e.ASIN] = q.length;
                    someFlag = true;
                    q.push(e.ASIN);
                    orderedProducts.push(e);
                  }
                  return e;
                });
                var simProds = simProds.map(function(e) {
                  return seenHash[e];
                })
                graph.add([orderedProducts[this.index], simProds]);
                // if (!someFlag) {throw new Error('flag did not toggle')}
                if (!someFlag) {console.log('flag did not toggle')}
                // console.log(newArray.length, "newArray.length", newArray.map(function(e) {return e.ASIN}));
                // for (var i = 0; i < newArray.length; i++) {
                //   if (newArray[i].ASIN in seenHash) {
                //     // console.log(newArray[i].ASIN)
                //     newArray.splice(i, 1);
                //   }
                //   else {
                //     j++;
                //     q.push(newArray[i]);
                //     console.log(q.map(function(e) {return e.ASIN}))
                //   }
                // }
                // console.log(newArray.length, "Added to the q");
                // simArray = simArray.concat(newArray);
                // build product entry to return to client
                product.product_id = obj.ASIN[0];
                product.price = parseInt(obj.ItemAttributes[0].ListPrice[0].Amount[0] / 100, 10);
                product.title = obj.ItemAttributes[0].Title[0];
                product.img_url = obj.MediumImage[0].URL[0];
                product.prod_attributes = JSON.stringify(obj.ItemAttributes[0]);
                product.category = obj.ItemAttributes[0].ProductGroup[0];

                //_results.push(product);
                similarHash[hashCount] = product.product_id;
                similarHT[product.product_id] = hashCount;
                hashCount++;
                // console.log(graph.al);
                // if (index % 15 === 0) {
                //   console.log(graph.al[index]);
                // }
                // if ((index-1) % 15 === 0) {
                //   console.log(similarHash);
                // }
                // if ((index) % 145 === 0) {
                //   console.log(graph.al);
                // }
                // newArray.forEach(function(e,index,a) {
                //   console.log(i * 5 + index, "in new array", e.ASIN);
                //   getMore(e, i * 5 + index, _results);
                // });

                //decrement number of total documents we want to return
                numberOfDocuments--;
              }
            }
          }
        }
        console.log('ONE CALL NOW', this.index, q.length);
        processQ(this.index + 1);
      }.bind(this));
    }
  }.bind(this), 1250);
};

