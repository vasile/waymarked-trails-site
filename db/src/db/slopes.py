# This file is part of the Waymarked Trails Map Project
# Copyright (C) 2015 Sarah Hoffmann
#
# This is free software; you can redistribute it and/or
# modify it under the terms of the GNU General Public License
# as published by the Free Software Foundation; either version 2
# of the License, or any later version.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU General Public License for more details.
#
# You should have received a copy of the GNU General Public License
# along with this program; if not, write to the Free Software
# Foundation, Inc., 59 Temple Place - Suite 330, Boston, MA  02111-1307, USA.

""" Database for the combinded route/way view (slopes)
"""
import osgende
from osgende.relations import RouteSegments
from osgende.ways import JoinedWays

from sqlalchemy import text, select, func, and_, column

from db.tables.piste import PisteRouteInfo, PisteWayInfo, PisteSegmentStyle
from db.configs import SlopeDBConfig, PisteTableConfig
from db.routes import DB as RoutesDB
from db import conf

CONF = conf.get('ROUTEDB', SlopeDBConfig)
PISTE_CONF = conf.get('PISTE', PisteTableConfig)

class DB(RoutesDB):
    routeinfo_class = PisteRouteInfo
    segmentstyle_class = PisteSegmentStyle

    def create_tables(self):
        # all the route stuff we take from the RoutesDB implmentation
        tables = super().create_tables()

        for t in tables:
            if isinstance(t, RouteSegments):
                segtable = t
                break
        else:
            raise RuntimeError("Segment table not found")

        # now create the additional joined ways
        subset = and_(text(CONF.way_subset),
                      column('id').notin_(select([func.unnest(segtable.data.c.ways)])))
        ways = PisteWayInfo(self.metadata, self.osmdata,
                            subset=subset, geom_change=tables[0])
        ways.set_num_threads(self.get_option('numthreads'))
        tables.append(ways)

        cols = ['name', 'symbol']
        cols.extend(PISTE_CONF.difficulty_map.keys())
        cols.extend(PISTE_CONF.piste_type)
        joins = JoinedWays(self.metadata, ways, cols,
                           self.osmdata, name=CONF.joinedway_table)
        tables.append(joins)

        return tables