/** EJS sayfa + layout sarmalayıcı */
export function renderPage(res, view, data = {}, layout = 'layout') {
  return new Promise((resolve, reject) => {
    res.render(view, data, (err, body) => {
      if (err) return reject(err);

      res.render(layout, { ...data, body }, (err2, html) => {
        if (err2) return reject(err2);
        res.send(html);
        resolve();
      });
    });
  });
}
