const fs = require('fs');
const readline = require('readline');
const path = require('path');

const resolvingRegex = /^======== Resolving module '([^']+?)' from '([^']+?)'. ========$/
const resolvedRegex = /^======== Module name '([^']+?)' was successfully resolved to '([^']+?)'.*. ========$/

const notResolvedRegecx = /^======== Module name '([^']+?)' was not resolved. ========$/

function getHtml({ nodes, edges }) {
  return `
  <html>
<head>
    <script type="text/javascript" src="https://unpkg.com/vis-network/standalone/umd/vis-network.min.js"></script>

    <style type="text/css">
        #mynetwork {
            width: 1600px;
            height: 1000px;
            border: 1px solid lightgray;
        }
    </style>
</head>
<body>
<div id="mynetwork"></div>

<script type="text/javascript">
    // create an array with nodes
    var nodes = new vis.DataSet(${JSON.stringify(nodes)});

    // create an array with edges
    var edges = new vis.DataSet(${JSON.stringify(edges)});

    // create a network
    var container = document.getElementById('mynetwork');

    // provide the data in the vis format
    var data = {
        nodes: nodes,
        edges: edges
    };
    var options = {
      layout: {
        randomSeed: 2,
        improvedLayout: true,
        clusterThreshold: 1,
      },
      edges: {
        length: 100,
        chosen: {
          edge: function (values) {
            console.log(values);
            values.width = 3;
            values.color = 'red';
          },
        },
      },
      physics: {
        // Even though it's disabled the options still apply to network.stabilize().
        enabled: false,
        barnesHut: {
          // springConstant: 0.1,
          avoidOverlap: 0.1,
        },
      },
      nodes: {
        chosen: {
          node: function (values) {
            console.log(values);
            values.color = 'red';
          },
        },
      },
    };

    // initialize your network!
    var network = new vis.Network(container, data, options);
    network.stabilize();
</script>
</body>
</html>
  `
}
function getFromCacheOrCompute(
  cache,
  key,
  compute,
) {
  const cachedVal = cache[key];
  if (cachedVal !== undefined) {
    return cachedVal;
  }
  const computedVal = compute(key);
  cache[key] = computedVal;
  return computedVal;
}

function findPackageJson(
  cache,
  currentDir,
) {
  const mbPackageJsonPath = path.join(currentDir, 'package.json');

  if (getFromCacheOrCompute(cache, mbPackageJsonPath, fs.existsSync)) {
    return mbPackageJsonPath;
  }
  const parentDir = path.resolve(currentDir, '..');
  if (parentDir == currentDir) {
    return undefined;
  }
  return findPackageJson(cache, parentDir);
}



function packageNameFromPath(packageJsonPath) {
  const packageJson = require(packageJsonPath);
  return packageJson['name']
}


function getPackageName(packageNameCache, cache, currentDir) {
  const packageJsonPath = findPackageJson(cache, currentDir);
  if (!packageJsonPath) {
    throw new Error('cannot find')
  }
  return getFromCacheOrCompute(
    packageNameCache,
    packageJsonPath,
    packageNameFromPath,
  );
}


async function processLineByLine() {
  // const fileStream = fs.createReadStream(__dirname + '/res.txt');
  const fileStream = process.stdin

  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });
  // Note: we use the crlfDelay option to recognize all instances of CR LF
  // ('\r\n') in input.txt as a single line break.

  let curState = { module: null, from: null };
  const data = {};
  const cache = {};
  const packageNameCache = {}

  for await (const line of rl) {
    // Each line in input.txt will be successively available here as `line`.
    if (line.startsWith('======== Resolving module ')) {
      if (curState.module || curState.from) {
        throw new Error('asd')
      }
      const groups = line.match(resolvingRegex)
      curState.module = groups[1]
      curState.from = groups[2]
    } else if (line.startsWith('======== Module name ')) {
      if (!line.match(notResolvedRegecx)) {
        const groups = line.match(resolvedRegex)
        if (!groups) {
          console.log(line)
        }
        if (groups[1] !== curState.module) {
          throw new Error('asd2')
        }
        const resolved = groups[2];
        const from = curState.from;

        const resolvedName = getPackageName(packageNameCache, cache, resolved);
        const fromName = getPackageName(packageNameCache, cache, from);
        if (fromName !== resolvedName && !resolved.endsWith('.js')) {
          if (!data[fromName]) {
            data[fromName] = new Set()
          }
          // if (resolvedName === '@wix/wix-code-classic-editor') {
          //   console.log(line)
          //   debugger
          // }
          data[fromName].add(resolvedName);
        }
      }
      curState = { module: null, from: null };
    }
  }


  const nodes = []


  const edges = [];
  for (let [from, toSet] of Object.entries(data)) {
    nodes.push({ id: from, label: from });
    for (let to of toSet.values()) {
      edges.push({ from: from, to: to, arrows: 'to' })
    }
  }
  const html = getHtml({ nodes, edges })

  process.stdout.write(html);
  // fs.writeFileSync(__dirname + '/output.html', html)

}

processLineByLine().catch(err => { console.error(err), process.exit(1) })

"======== Module name 'tslib' was successfully resolved to '/home/badim/work/santa-editor-parent2/node_modules/tslib/tslib.d.ts' with Package ID 'tslib/tslib.d.ts@1.14.1'. ========"