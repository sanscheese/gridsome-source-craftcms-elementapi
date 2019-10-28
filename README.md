# Craft CMS (Element API plugin) source for Gridsome

> This package is under development. The API might change before v1 is released.

## Craft CMS setup

1. Install the [Element API plugin](https://github.com/craftcms/element-api) in your Craft CMS build.

2. Setup the `config/element-api.php` with the following endpoints:

> Warning: this will make all the content (and users) of your site public via the API. If you have data that shouldn't be public, then make sure you know what you are doing before using this 😀

``` php
use craft\elements\Asset;
use craft\elements\Category;
use craft\elements\Entry;
use craft\elements\GlobalSet;
use craft\elements\MatrixBlock;
use craft\elements\Tag;
use craft\elements\User;

return [
    'endpoints' => [
        'api/1.0/gridsome/elements/<elementType:\w+>.json' => function($elementType) {
            return [
                'elementType' => "craft\\elements\\$elementType",
                'paginate' => true,
                'elementsPerPage' => 100,
            ];
        },

        'api/1.0/gridsome/elementsId/<elementType:\w+>.json' => function($elementType) {
            global $globalElementType;
            $globalElementType = $elementType;

            return [
                'elementType' => "craft\\elements\\$elementType",
                'paginate' => false,
                'transformer' => function($item) {
                    global $globalElementType;

                    switch ($globalElementType) {
                        case 'entry':
                        case 'matrixblock':
                            $itemType = $item->type->name;
                            break;
                        case 'asset':
                            $itemType = $item->volume->name;
                            break;
                        case 'category':
                        case 'tag':
                            $itemType = $item->group->name;
                            break;
                        default:
                            $itemType = null;
                    }

                    $isSingle = false;
                    if (isset($item->section) && $item->section->type == "single") {
                        $isSingle = true;
                    }

                    return [
                        'id' => $item->id,
                        'type' => $itemType,
                        'isSingle' => $isSingle,
                    ];
                },
            ];
        },
    ]
];
```

## Gridsome install

- `yarn add @bhws/gridsome-source-craftcms-elementapi`
- **OR** `npm install @bhws/gridsome-source-craftcms-elementapi`

## Usage

```js
module.exports = {
  plugins: [
    {
      use: '@bhws/gridsome-source-craftcms-elementapi',
      options: {
        baseUrl: 'WEBSITE_URL', // required
        apiBase: 'api/1.0/gridsome',
        typeNamePrefix: 'craft',
        concurrent: 10
      }
    }
  ],
}
```
